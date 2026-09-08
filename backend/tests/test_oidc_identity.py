"""Which local account a verified id token is allowed to sign in as.

Every branch here decides whether somebody gets into an existing account, so
these run against a real SQLite session rather than a stand-in: the lookups
being tested are the queries, not a mock of them.
"""

import os
import unittest
from unittest import mock

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ENCRYPTION_KEY", "Ml4v57Co5JT1bqiqQ5ybWBg5Iq1eRVCDhKTxF4ITsIE=")

from sqlalchemy import event  # noqa: E402
from sqlmodel import Session, create_engine, select  # noqa: E402

from models.base import SQLModelBase  # noqa: E402
from models.instance_config import InstanceConfig, InstanceMode  # noqa: E402
from models.user import User, UserRole  # noqa: E402
from models.user_identity import UserIdentity  # noqa: E402
from services import identity  # noqa: E402
from services.oidc import OidcError  # noqa: E402

ISSUER = "https://issuer.test"


def a_session() -> Session:
    engine = create_engine("sqlite://")
    schema = SQLModelBase.metadata.schema
    if schema:
        # The models are bound to a named schema; SQLite only has one, so it is
        # attached under that name for the tables to land in.
        event.listen(
            engine,
            "connect",
            lambda connection, _: connection.execute(f"ATTACH DATABASE ':memory:' AS {schema}"),
        )
    SQLModelBase.metadata.create_all(engine)
    return Session(engine)


def claims(**overrides) -> dict:
    return {
        "iss": ISSUER,
        "sub": "subject-1",
        "email": "someone@example.com",
        "email_verified": True,
        "given_name": "Some",
        "family_name": "One",
        **overrides,
    }


def provisioning(allowed: bool):
    return mock.patch.object(identity, "OIDC_AUTO_PROVISION", allowed)


class AnAccountAlreadyLinked(unittest.TestCase):
    def test_it_is_the_one_signed_in(self):
        session = a_session()
        user = User(email="someone@example.com", hashed_password="x")
        session.add(user)
        session.flush()
        session.add(UserIdentity(user_id=user.id, issuer=ISSUER, subject="subject-1"))
        session.flush()

        with provisioning(False):
            self.assertEqual(identity.resolve(session, claims()).id, user.id)

    def test_the_email_no_longer_has_to_match(self):
        """People change their address at the provider. The subject is what the
        account was linked on, and it is what still decides."""
        session = a_session()
        user = User(email="old@example.com", hashed_password="x")
        session.add(user)
        session.flush()
        session.add(UserIdentity(user_id=user.id, issuer=ISSUER, subject="subject-1"))
        session.flush()

        with provisioning(False):
            found = identity.resolve(session, claims(email="new@example.com"))
        self.assertEqual(found.id, user.id)
        self.assertEqual(found.email, "old@example.com")

    def test_a_link_to_a_deleted_account_does_not_sign_anyone_in(self):
        session = a_session()
        session.add(UserIdentity(user_id=__import__("uuid").uuid4(), issuer=ISSUER, subject="subject-1"))
        session.flush()

        with provisioning(False):
            with self.assertRaises(OidcError):
                identity.resolve(session, claims())


class AnAccountThatExistsButIsNotLinked(unittest.TestCase):
    def setUp(self):
        self.session = a_session()
        self.existing = User(email="someone@example.com", hashed_password="x")
        self.session.add(self.existing)
        self.session.flush()

    def test_a_verified_address_claims_it(self):
        with provisioning(False):
            found = identity.resolve(self.session, claims())
        self.assertEqual(found.id, self.existing.id)
        self.assertEqual(len(self.session.exec(select(User)).all()), 1)

    def test_an_unverified_address_does_not(self):
        """Otherwise anyone who can type an address at a provider that does not
        check them signs in as its owner."""
        with provisioning(True):
            with self.assertRaises(OidcError) as caught:
                identity.resolve(self.session, claims(email_verified=False))
        self.assertIn("did not verify", str(caught.exception))

    def test_a_missing_verified_flag_does_not_either(self):
        with provisioning(True):
            with self.assertRaises(OidcError):
                identity.resolve(self.session, claims(email_verified=None))

    def test_the_address_is_matched_without_regard_to_case(self):
        with provisioning(False):
            found = identity.resolve(self.session, claims(email="SomeOne@Example.com"))
        self.assertEqual(found.id, self.existing.id)


class NoAccountYet(unittest.TestCase):
    def test_nothing_is_created_unless_provisioning_is_on(self):
        session = a_session()
        with provisioning(False):
            with self.assertRaises(OidcError) as caught:
                identity.resolve(session, claims())
        self.assertIn("admin", str(caught.exception))
        self.assertEqual(session.exec(select(User)).all(), [])

    def test_provisioning_makes_a_student_with_no_password(self):
        session = a_session()
        session.add(InstanceConfig(mode=InstanceMode.multi))
        session.flush()

        with provisioning(True):
            made = identity.resolve(session, claims())

        self.assertEqual(made.email, "someone@example.com")
        self.assertEqual(made.role, UserRole.student)
        self.assertIsNone(made.hashed_password)
        self.assertEqual(made.first_name, "Some")
        linked = session.exec(select(UserIdentity)).all()
        self.assertEqual([(link.issuer, link.subject) for link in linked], [(ISSUER, "subject-1")])

    def test_a_single_user_instance_will_not_make_a_second_account(self):
        session = a_session()
        session.add(InstanceConfig(mode=InstanceMode.single))
        session.flush()

        with provisioning(True):
            with self.assertRaises(OidcError) as caught:
                identity.resolve(session, claims())
        self.assertIn("single-user", str(caught.exception))

    def test_a_token_with_no_email_gets_nowhere(self):
        session = a_session()
        with provisioning(True):
            with self.assertRaises(OidcError) as caught:
                identity.resolve(session, claims(email=None))
        self.assertIn("no email", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
