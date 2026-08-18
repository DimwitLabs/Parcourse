import unittest

from database import with_driver

SUPABASE = "postgres.abc:pw@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"


class WithDriver(unittest.TestCase):
    """Every hosted provider hands out a bare postgresql:// URL, and SQLAlchemy
    reads that as psycopg2, which is not installed."""

    def test_bare_postgresql_gets_the_installed_driver(self):
        self.assertEqual(
            with_driver(f"postgresql://{SUPABASE}"),
            f"postgresql+psycopg://{SUPABASE}",
        )

    def test_legacy_postgres_scheme_is_accepted_too(self):
        self.assertEqual(
            with_driver(f"postgres://{SUPABASE}"),
            f"postgresql+psycopg://{SUPABASE}",
        )

    def test_an_explicit_driver_is_left_alone(self):
        url = f"postgresql+psycopg://{SUPABASE}"
        self.assertEqual(with_driver(url), url)

    def test_other_databases_are_untouched(self):
        self.assertEqual(with_driver("sqlite:///local.db"), "sqlite:///local.db")

    def test_a_password_containing_the_scheme_is_not_mangled(self):
        url = "postgresql://user:postgres://x@host:5432/db"
        self.assertEqual(with_driver(url), f"postgresql+psycopg://user:postgres://x@host:5432/db")




class CheckedSchema(unittest.TestCase):
    def test_plain_names_pass(self):
        from database import checked_schema

        self.assertEqual(checked_schema("parcourse"), "parcourse")
        self.assertEqual(checked_schema("_app2"), "_app2")

    def test_names_that_would_change_under_folding_are_refused(self):
        from database import checked_schema

        with self.assertRaises(ValueError):
            checked_schema("Parcourse")

    def test_injection_attempts_are_refused(self):
        from database import checked_schema

        for name in ("public; drop schema public cascade", "a b", "a-b", ""):
            with self.assertRaises(ValueError):
                checked_schema(name)


class FailureMessage(unittest.TestCase):
    """A wrong setting should read as one line, not a driver stack."""

    def test_it_names_the_target_and_the_cause(self):
        from database import failure_message

        exc = Exception()
        exc.orig = Exception("connection failed: FATAL:  password authentication failed\nmore noise")
        message = failure_message(
            "postgresql+psycopg://u:p@db.example.com:6543/postgres", "parcourse", exc
        )
        self.assertIn("db.example.com:6543/postgres", message)
        self.assertIn("schema parcourse", message)
        self.assertIn("password authentication failed", message)
        self.assertNotIn("more noise", message)
        self.assertNotIn("p@", message)


if __name__ == "__main__":
    unittest.main()
