"""An instance where the provider is the only way in.

Every place that would otherwise offer a password has to refuse, because a
password set on such an instance could never be used to sign in with. Half a
refusal is the dangerous shape: an admin hands out a password, and the person
they gave it to finds out at the login screen that it does nothing.
"""

import os
import unittest
from unittest import mock

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ENCRYPTION_KEY", "Ml4v57Co5JT1bqiqQ5ybWBg5Iq1eRVCDhKTxF4ITsIE=")

from fastapi import HTTPException  # noqa: E402
from sqlalchemy import event  # noqa: E402
from sqlmodel import Session, create_engine, select  # noqa: E402

from config import _checked_oidc_only, _checked_post_login_url, _checked_secret  # noqa: E402
from models.base import SQLModelBase  # noqa: E402
from models.instance_config import InstanceMode  # noqa: E402
from models.user import User, UserRole  # noqa: E402
from routers import auth as auth_router  # noqa: E402
from routers import users as users_router  # noqa: E402
from schemas.auth import (  # noqa: E402
    ChangePasswordRequest,
    CreateUserRequest,
    LoginRequest,
    ResetPasswordRequest,
    SetupRequest,
)
from services.auth import hash_password  # noqa: E402

KNOWN = "Password1"
WANTED = "Password2"


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


def an_account(session: Session, password: str | None) -> User:
    user = User(
        email="someone@example.com",
        hashed_password=hash_password(password) if password else None,
        role=UserRole.student,
    )
    session.add(user)
    session.flush()
    return user


class TheSettingItself(unittest.TestCase):
    def test_it_needs_a_provider_to_stand_in(self):
        """Otherwise it takes the only way in away and puts nothing back."""
        with self.assertRaises(ValueError) as caught:
            _checked_oidc_only(True, False)
        self.assertIn("OIDC_ISSUER", str(caught.exception))

    def test_it_is_allowed_once_one_is_configured(self):
        self.assertIs(_checked_oidc_only(True, True), True)

    def test_it_is_off_without_a_provider(self):
        self.assertIs(_checked_oidc_only(False, False), False)


class WhereTheBrowserLandsAfterwards(unittest.TestCase):
    def test_the_first_allowed_origin_stands_in(self):
        self.assertEqual(_checked_post_login_url("", ["https://app.test"], True), "https://app.test")

    def test_an_explicit_one_wins(self):
        self.assertEqual(
            _checked_post_login_url("https://elsewhere.test", ["https://app.test"], True),
            "https://elsewhere.test",
        )

    def test_having_nowhere_to_land_stops_the_app(self):
        """A blank one sends the browser to the API's own origin, where the app
        is not served, and the sign-in appears to hang."""
        with self.assertRaises(ValueError) as caught:
            _checked_post_login_url("", [], True)
        self.assertIn("OIDC_POST_LOGIN_URL", str(caught.exception))

    def test_it_does_not_matter_without_a_provider(self):
        self.assertEqual(_checked_post_login_url("", [], False), "")


class TheSecretsThemselves(unittest.TestCase):
    def test_stray_whitespace_is_not_part_of_the_secret(self):
        self.assertEqual(_checked_secret("JWT_SECRET", "  abc  ", "published", "run this"), "abc")

    def test_whitespace_alone_is_still_empty(self):
        with self.assertRaises(ValueError):
            _checked_secret("JWT_SECRET", "   ", "published", "run this")

    def test_the_value_parcourse_used_to_ship_is_refused(self):
        with self.assertRaises(ValueError):
            _checked_secret("JWT_SECRET", "published", "published", "run this")


class SigningIn(unittest.TestCase):
    def setUp(self):
        self.session = a_session()
        self.user = an_account(self.session, KNOWN)

    def test_a_password_is_refused_even_when_it_is_right(self):
        with mock.patch.object(auth_router, "OIDC_ONLY", True):
            with self.assertRaises(HTTPException) as caught:
                auth_router.login(
                    LoginRequest(email=self.user.email, password=KNOWN), self.session
                )
        self.assertEqual(caught.exception.status_code, 403)

    def test_it_still_works_when_the_setting_is_off(self):
        with mock.patch.object(auth_router, "OIDC_ONLY", False):
            token = auth_router.login(
                LoginRequest(email=self.user.email, password=KNOWN), self.session
            )
        self.assertTrue(token.access_token)


class ChangingAPassword(unittest.TestCase):
    def setUp(self):
        self.session = a_session()
        self.user = an_account(self.session, KNOWN)

    def test_it_is_refused(self):
        with mock.patch.object(auth_router, "OIDC_ONLY", True):
            with self.assertRaises(HTTPException) as caught:
                auth_router.change_password(
                    ChangePasswordRequest(password=WANTED, current_password=KNOWN),
                    self.user,
                    self.session,
                )
        self.assertEqual(caught.exception.status_code, 403)


class AnAdminActingOnSomebodyElse(unittest.TestCase):
    def setUp(self):
        self.session = a_session()
        self.user = an_account(self.session, KNOWN)
        self.admin = User(email="admin@example.com", hashed_password=hash_password(KNOWN), role=UserRole.admin)
        self.session.add(self.admin)
        self.session.flush()

    def test_they_cannot_reset_a_password(self):
        with mock.patch.object(users_router, "OIDC_ONLY", True):
            with self.assertRaises(HTTPException) as caught:
                users_router.reset_user_password(
                    self.user.id, ResetPasswordRequest(password=WANTED), self.admin, self.session
                )
        self.assertEqual(caught.exception.status_code, 403)

    def test_they_cannot_hand_one_out_with_a_new_account(self):
        with mock.patch.object(users_router, "OIDC_ONLY", True):
            with self.assertRaises(HTTPException) as caught:
                users_router.create_user(
                    CreateUserRequest(email="new@example.com", password=WANTED),
                    self.admin,
                    self.session,
                )
        self.assertEqual(caught.exception.status_code, 422)

    def test_an_account_without_one_is_fine(self):
        # OIDC_ONLY cannot be set without a provider configured, so both hold.
        with mock.patch.object(users_router, "OIDC_ONLY", True), mock.patch.object(
            users_router, "OIDC_ENABLED", True
        ):
            created = users_router.create_user(
                CreateUserRequest(email="new@example.com"), self.admin, self.session
            )
        self.assertIs(created.has_password, False)


class ProviderOnlyAndSelfServiceTogether(unittest.TestCase):
    """OIDC_ONLY says how people sign in; OIDC_AUTO_PROVISION says who may.
    They are separate questions, and turning both on has to keep both answers."""

    def setUp(self):
        self.session = a_session()

    def test_a_new_account_arrives_without_a_password(self):
        from models.instance_config import INSTANCE_ID, InstanceConfig
        from services import identity

        self.session.add(InstanceConfig(id=INSTANCE_ID, mode=InstanceMode.multi))
        self.session.commit()

        with mock.patch.object(identity, "OIDC_AUTO_PROVISION", True):
            user = identity.resolve(
                self.session,
                {
                    "iss": "https://issuer.test",
                    "sub": "abc",
                    "email": "new@example.com",
                    "email_verified": True,
                },
            )
        self.assertIsNone(user.hashed_password)
        self.assertIs(user.must_change_password, False)


class SettingTheInstanceUp(unittest.TestCase):
    def setUp(self):
        self.session = a_session()

    def test_the_first_admin_needs_no_password(self):
        with mock.patch.object(auth_router, "OIDC_ONLY", True):
            token = auth_router.setup(
                SetupRequest(email="admin@example.com", mode=InstanceMode.multi), self.session
            )
        self.assertTrue(token.access_token)
        admin = self.session.exec(select(User)).first()
        self.assertIsNone(admin.hashed_password)
        self.assertIs(admin.must_change_password, False)

    def test_a_password_is_refused_when_the_provider_is_the_only_way_in(self):
        with mock.patch.object(auth_router, "OIDC_ONLY", True):
            with self.assertRaises(HTTPException) as caught:
                auth_router.setup(
                    SetupRequest(email="admin@example.com", password=KNOWN, mode=InstanceMode.multi),
                    self.session,
                )
        self.assertEqual(caught.exception.status_code, 422)

    def test_the_setup_screen_can_ask_before_there_is_an_instance(self):
        """Otherwise it has no way to know not to offer a password."""
        with mock.patch.object(auth_router, "OIDC_ONLY", True), mock.patch.object(
            auth_router, "OIDC_ENABLED", True
        ):
            config = auth_router.get_config(self.session)
        self.assertIsNone(config.mode)
        self.assertIs(config.oidc.only, True)

    def test_one_is_still_required_without_a_provider(self):
        with mock.patch.object(auth_router, "OIDC_ONLY", False):
            with self.assertRaises(HTTPException) as caught:
                auth_router.setup(
                    SetupRequest(email="admin@example.com", mode=InstanceMode.multi), self.session
                )
        self.assertEqual(caught.exception.status_code, 422)


if __name__ == "__main__":
    unittest.main()
