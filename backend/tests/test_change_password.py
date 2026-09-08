"""Who is allowed to set a password on an account.

A session token is enough to act as somebody. It should not be enough to take
their account away from them, which is what changing the password without
knowing it would amount to.
"""

import os
import unittest

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ENCRYPTION_KEY", "Ml4v57Co5JT1bqiqQ5ybWBg5Iq1eRVCDhKTxF4ITsIE=")

from fastapi import HTTPException  # noqa: E402
from sqlalchemy import event  # noqa: E402
from sqlmodel import Session, create_engine  # noqa: E402

from models.base import SQLModelBase  # noqa: E402
from models.user import User, UserRole  # noqa: E402
from routers.auth import change_password  # noqa: E402
from schemas.auth import ChangePasswordRequest  # noqa: E402
from services.auth import hash_password, verify_password  # noqa: E402

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


class AnAccountWithAPassword(unittest.TestCase):
    def setUp(self):
        self.session = a_session()
        self.user = an_account(self.session, KNOWN)

    def test_the_current_one_lets_it_through(self):
        change_password(
            ChangePasswordRequest(password=WANTED, current_password=KNOWN), self.user, self.session
        )
        self.assertTrue(verify_password(WANTED, self.user.hashed_password))

    def test_the_wrong_one_does_not(self):
        with self.assertRaises(HTTPException) as caught:
            change_password(
                ChangePasswordRequest(password=WANTED, current_password="Guessing1"),
                self.user,
                self.session,
            )
        self.assertEqual(caught.exception.status_code, 403)
        self.assertTrue(verify_password(KNOWN, self.user.hashed_password))

    def test_leaving_it_out_does_not(self):
        """A stolen session alone must not be enough to take the account."""
        with self.assertRaises(HTTPException) as caught:
            change_password(ChangePasswordRequest(password=WANTED), self.user, self.session)
        self.assertEqual(caught.exception.status_code, 403)
        self.assertTrue(verify_password(KNOWN, self.user.hashed_password))

    def test_the_forced_change_flag_is_cleared(self):
        self.user.must_change_password = True
        change_password(
            ChangePasswordRequest(password=WANTED, current_password=KNOWN), self.user, self.session
        )
        self.assertFalse(self.user.must_change_password)


class AnAccountWithoutOne(unittest.TestCase):
    """Signed in through a provider, adding a password for the first time."""

    def setUp(self):
        self.session = a_session()
        self.user = an_account(self.session, None)

    def test_it_can_set_one_with_nothing_to_prove(self):
        change_password(ChangePasswordRequest(password=WANTED), self.user, self.session)
        self.assertTrue(verify_password(WANTED, self.user.hashed_password))

    def test_and_then_the_current_one_is_required(self):
        change_password(ChangePasswordRequest(password=WANTED), self.user, self.session)
        with self.assertRaises(HTTPException):
            change_password(ChangePasswordRequest(password=KNOWN), self.user, self.session)


if __name__ == "__main__":
    unittest.main()
