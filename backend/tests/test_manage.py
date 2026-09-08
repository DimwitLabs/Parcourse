"""The operator command, which is the last way into a locked-out instance.

It runs outside any request, so nothing else checks its work: if it writes a
password that cannot be used, the person running it has no way to tell.
"""

import io
import os
import unittest
from contextlib import redirect_stderr, redirect_stdout
from unittest import mock

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ENCRYPTION_KEY", "Ml4v57Co5JT1bqiqQ5ybWBg5Iq1eRVCDhKTxF4ITsIE=")

from sqlalchemy import event  # noqa: E402
from sqlmodel import Session, create_engine  # noqa: E402

import manage  # noqa: E402
from models.base import SQLModelBase  # noqa: E402
from models.user import User, UserRole  # noqa: E402
from services.auth import hash_password, verify_password  # noqa: E402

KNOWN = "Password1"
WANTED = "Password2"


class ResettingAPassword(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        schema = SQLModelBase.metadata.schema
        if schema:
            event.listen(
                self.engine,
                "connect",
                lambda connection, _: connection.execute(f"ATTACH DATABASE ':memory:' AS {schema}"),
            )
        SQLModelBase.metadata.create_all(self.engine)
        with Session(self.engine) as session:
            session.add(User(email="admin@example.com", hashed_password=hash_password(KNOWN), role=UserRole.admin))
            session.commit()

        patch = mock.patch.object(manage, "engine", self.engine)
        patch.start()
        self.addCleanup(patch.stop)

    def user(self) -> User:
        with Session(self.engine) as session:
            from sqlmodel import select

            return session.exec(select(User).where(User.email == "admin@example.com")).first()

    def run_it(self, email: str, password: str | None) -> tuple[int, str]:
        err = io.StringIO()
        with redirect_stdout(io.StringIO()), redirect_stderr(err):
            code = manage.reset_password(email, password)
        return code, err.getvalue()

    def test_it_sets_the_password_and_asks_for_a_change(self):
        code, _ = self.run_it("admin@example.com", WANTED)
        self.assertEqual(code, 0)
        user = self.user()
        self.assertTrue(verify_password(WANTED, user.hashed_password))
        self.assertIs(user.must_change_password, True)

    def test_an_unknown_address_changes_nothing(self):
        code, err = self.run_it("nobody@example.com", WANTED)
        self.assertEqual(code, 1)
        self.assertIn("No user", err)
        self.assertTrue(verify_password(KNOWN, self.user().hashed_password))

    def test_an_empty_password_is_refused(self):
        code, err = self.run_it("admin@example.com", "")
        self.assertEqual(code, 1)
        self.assertIn("empty", err)
        self.assertTrue(verify_password(KNOWN, self.user().hashed_password))

    def test_it_refuses_on_a_provider_only_instance(self):
        """A password written here could never be used to sign in with."""
        with mock.patch.object(manage, "OIDC_ONLY", True):
            code, err = self.run_it("admin@example.com", WANTED)
        self.assertEqual(code, 1)
        self.assertIn("OIDC_ONLY", err)
        self.assertTrue(verify_password(KNOWN, self.user().hashed_password))


if __name__ == "__main__":
    unittest.main()
