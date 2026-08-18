"""Hashing had no test of its own, so a bcrypt upgrade that broke every
password still left the suite green.
"""

import os
import unittest

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ENCRYPTION_KEY", "uvSAXyWG429v7tYFyht42Jud0v--hr42pitofMf0pTY=")

from services.auth import hash_password, verify_password  # noqa: E402

# Written by passlib 1.7.4 with bcrypt 4.0.1, the pair this replaced. Anyone
# who signed up before the change carries a hash of this shape.
LEGACY_HASH = "$2b$12$9BQHZH3YsvanYQ4PqgDpt.n5p.Xbe6FnHA/SdgxLXxlMkb0ITx.we"
LEGACY_PASSWORD = "SuperSecret123"


class HashingTests(unittest.TestCase):
    def test_a_password_verifies_against_its_own_hash(self):
        self.assertTrue(verify_password("SuperSecret123", hash_password("SuperSecret123")))

    def test_the_wrong_password_does_not(self):
        self.assertFalse(verify_password("WrongOne123", hash_password("SuperSecret123")))

    def test_the_same_password_hashes_differently_each_time(self):
        self.assertNotEqual(hash_password("SuperSecret123"), hash_password("SuperSecret123"))

    def test_a_hash_written_before_this_change_still_signs_in(self):
        self.assertTrue(verify_password(LEGACY_PASSWORD, LEGACY_HASH))
        self.assertFalse(verify_password("WrongOne123", LEGACY_HASH))


class SignInSurvivesJunk(unittest.TestCase):
    """Sign-in takes the password unvalidated, so anything can arrive here."""

    def test_a_password_past_what_bcrypt_reads_is_refused_not_raised(self):
        self.assertFalse(verify_password("x" * 200, hash_password("SuperSecret123")))

    def test_a_stored_value_that_is_not_a_hash_is_refused_not_raised(self):
        self.assertFalse(verify_password("SuperSecret123", "not-a-hash"))
