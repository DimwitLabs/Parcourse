"""The two routes a browser actually visits.

`test_oidc_flow` covers the protocol; this covers the glue around it, which is
where the security lives: a state row is spent the moment it is presented, an
old one is refused, and nothing the provider says is echoed back to the browser.
"""

import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ENCRYPTION_KEY", "Ml4v57Co5JT1bqiqQ5ybWBg5Iq1eRVCDhKTxF4ITsIE=")

from fastapi import HTTPException  # noqa: E402
from sqlalchemy import event  # noqa: E402
from sqlmodel import Session, create_engine, select  # noqa: E402

from models.base import SQLModelBase  # noqa: E402
from models.oidc_login import OidcLogin  # noqa: E402
from models.user import User, UserRole  # noqa: E402
from routers import auth as auth_router  # noqa: E402
from services import oidc as oidc_service  # noqa: E402

APP = "https://app.test"


def a_session() -> Session:
    engine = create_engine("sqlite://")
    schema = SQLModelBase.metadata.schema
    if schema:
        event.listen(
            engine,
            "connect",
            lambda connection, _: connection.execute(f"ATTACH DATABASE ':memory:' AS {schema}"),
        )
    SQLModelBase.metadata.create_all(engine)
    return Session(engine)


def fragment(response) -> str:
    return response.headers["location"].split("#", 1)[-1]


class EndpointTestCase(unittest.TestCase):
    def setUp(self):
        self.session = a_session()
        patches = [
            mock.patch.object(auth_router, "OIDC_ENABLED", True),
            mock.patch.object(auth_router, "OIDC_ISSUER", "https://issuer.test"),
            mock.patch.object(auth_router, "OIDC_POST_LOGIN_URL", APP),
        ]
        for patch in patches:
            patch.start()
            self.addCleanup(patch.stop)


class WhenSingleSignOnIsOff(unittest.TestCase):
    def setUp(self):
        self.session = a_session()

    def test_start_is_not_there(self):
        with mock.patch.object(auth_router, "OIDC_ENABLED", False):
            with self.assertRaises(HTTPException) as caught:
                auth_router.oidc_start(self.session)
        self.assertEqual(caught.exception.status_code, 404)

    def test_the_callback_is_not_there_either(self):
        with mock.patch.object(auth_router, "OIDC_ENABLED", False):
            with self.assertRaises(HTTPException) as caught:
                auth_router.oidc_callback("s", "c", "", self.session)
        self.assertEqual(caught.exception.status_code, 404)


class StartingASignIn(EndpointTestCase):
    def test_it_records_the_state_it_sent(self):
        with mock.patch.object(oidc_service, "start", return_value=("https://issuer.test/authorize", "verifier")):
            response = auth_router.oidc_start(self.session)

        self.assertEqual(response.status_code, 307)
        rows = self.session.exec(select(OidcLogin)).all()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].code_verifier, "verifier")

    def test_every_sign_in_gets_its_own_state_and_nonce(self):
        with mock.patch.object(oidc_service, "start", return_value=("https://issuer.test/authorize", "v")):
            auth_router.oidc_start(self.session)
            auth_router.oidc_start(self.session)

        rows = self.session.exec(select(OidcLogin)).all()
        self.assertEqual(len({r.state for r in rows}), 2)
        self.assertEqual(len({r.nonce for r in rows}), 2)

    def test_stale_rows_are_swept_up(self):
        old = OidcLogin(state="ancient", code_verifier="v", nonce="n")
        old.created_at = datetime.now(timezone.utc) - timedelta(hours=2)
        self.session.add(old)
        self.session.commit()

        with mock.patch.object(oidc_service, "start", return_value=("https://issuer.test/authorize", "v")):
            auth_router.oidc_start(self.session)

        self.assertIsNone(self.session.get(OidcLogin, "ancient"))

    def test_an_unreachable_provider_does_not_leak_why(self):
        with mock.patch.object(oidc_service, "start", side_effect=oidc_service.OidcError("connect to 10.0.0.4 failed")):
            with self.assertRaises(HTTPException) as caught:
                auth_router.oidc_start(self.session)
        self.assertEqual(caught.exception.status_code, 502)
        self.assertNotIn("10.0.0.4", caught.exception.detail)


class ComingBackFromTheProvider(EndpointTestCase):
    def a_pending_login(self, state: str = "the-state", age: timedelta = timedelta()) -> OidcLogin:
        row = OidcLogin(state=state, code_verifier="verifier", nonce="the-nonce")
        row.created_at = datetime.now(timezone.utc) - age
        self.session.add(row)
        self.session.commit()
        return row

    def test_a_state_nobody_started_is_refused(self):
        response = auth_router.oidc_callback("invented", "code", "", self.session)
        self.assertIn("error=", fragment(response))
        self.assertNotIn("token=", fragment(response))

    def test_the_state_is_spent_even_when_the_sign_in_works(self):
        """Otherwise the same code could be presented twice."""
        self.a_pending_login()
        user = User(email="a@example.com", hashed_password=None, role=UserRole.student)
        self.session.add(user)
        self.session.commit()

        with mock.patch.object(oidc_service, "claims", return_value={"sub": "1", "email": "a@example.com"}):
            with mock.patch.object(auth_router.identity, "resolve", return_value=user):
                response = auth_router.oidc_callback("the-state", "code", "", self.session)

        self.assertIn("token=", fragment(response))
        self.assertIsNone(self.session.get(OidcLogin, "the-state"))

    def test_replaying_the_same_state_is_refused(self):
        self.a_pending_login()
        user = User(email="a@example.com", hashed_password=None, role=UserRole.student)
        self.session.add(user)
        self.session.commit()

        with mock.patch.object(oidc_service, "claims", return_value={"sub": "1", "email": "a@example.com"}):
            with mock.patch.object(auth_router.identity, "resolve", return_value=user):
                auth_router.oidc_callback("the-state", "code", "", self.session)
                again = auth_router.oidc_callback("the-state", "code", "", self.session)

        self.assertNotIn("token=", fragment(again))

    def test_a_state_older_than_the_window_is_refused(self):
        self.a_pending_login(age=timedelta(minutes=11))
        with mock.patch.object(oidc_service, "claims") as exchanged:
            response = auth_router.oidc_callback("the-state", "code", "", self.session)
        exchanged.assert_not_called()
        self.assertIn("error=", fragment(response))

    def test_a_spent_state_is_gone_even_when_the_exchange_fails(self):
        self.a_pending_login()
        with mock.patch.object(oidc_service, "claims", side_effect=oidc_service.OidcError("nope")):
            auth_router.oidc_callback("the-state", "code", "", self.session)
        self.assertIsNone(self.session.get(OidcLogin, "the-state"))

    def test_the_provider_s_own_error_text_is_not_reflected(self):
        """It arrives in the query string, so anybody can put anything there."""
        response = auth_router.oidc_callback("", "", "<script>alert(1)</script>", self.session)
        self.assertNotIn("script", fragment(response))

    def test_the_token_travels_in_the_fragment_never_the_query(self):
        """A fragment is not sent to servers and stays out of access logs."""
        self.a_pending_login()
        user = User(email="a@example.com", hashed_password=None, role=UserRole.student)
        self.session.add(user)
        self.session.commit()

        with mock.patch.object(oidc_service, "claims", return_value={"sub": "1", "email": "a@example.com"}):
            with mock.patch.object(auth_router.identity, "resolve", return_value=user):
                response = auth_router.oidc_callback("the-state", "code", "", self.session)

        location = response.headers["location"]
        self.assertIn("#token=", location)
        self.assertNotIn("?token=", location)
        self.assertTrue(location.startswith(APP))


if __name__ == "__main__":
    unittest.main()
