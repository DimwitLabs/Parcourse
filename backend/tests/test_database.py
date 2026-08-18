"""Pointing the app at somebody else's Postgres: the connection string it will
accept, the schema it is allowed to use, and what it says when either is wrong.
"""

import unittest

from config import _checked_schema, _with_driver
from database import _failure_message

SUPABASE = "postgres.abc:pw@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"


class WithDriverTests(unittest.TestCase):
    """Every hosted provider hands out a bare postgresql:// URL, and SQLAlchemy
    reads that as psycopg2, which is not installed."""

    def test_bare_postgresql_gets_the_installed_driver(self):
        self.assertEqual(
            _with_driver(f"postgresql://{SUPABASE}"), f"postgresql+psycopg://{SUPABASE}"
        )

    def test_legacy_postgres_scheme_is_accepted_too(self):
        self.assertEqual(
            _with_driver(f"postgres://{SUPABASE}"), f"postgresql+psycopg://{SUPABASE}"
        )

    def test_an_explicit_driver_is_left_alone(self):
        url = f"postgresql+psycopg://{SUPABASE}"
        self.assertEqual(_with_driver(url), url)

    def test_other_databases_are_untouched(self):
        self.assertEqual(_with_driver("sqlite:///local.db"), "sqlite:///local.db")

    def test_a_password_containing_the_scheme_is_not_mangled(self):
        url = "postgresql://user:postgres://x@host:5432/db"
        self.assertEqual(_with_driver(url), "postgresql+psycopg://user:postgres://x@host:5432/db")


class CheckedSchemaTests(unittest.TestCase):
    """The name is interpolated into CREATE SCHEMA, so this is the only guard."""

    def test_plain_names_pass(self):
        self.assertEqual(_checked_schema("parcourse"), "parcourse")
        self.assertEqual(_checked_schema("_app2"), "_app2")

    def test_names_that_would_change_under_folding_are_refused(self):
        with self.assertRaises(ValueError):
            _checked_schema("Parcourse")

    def test_injection_attempts_are_refused(self):
        for name in ("public; drop schema public cascade", "a b", "a-b", ""):
            with self.assertRaises(ValueError):
                _checked_schema(name)


class SchemaQualificationTests(unittest.TestCase):
    """Tables carry their schema, so nothing depends on search_path and
    create_all cannot match a table sitting in a different one."""

    def test_tables_are_qualified_with_the_configured_schema(self):
        from models.base import SQLModelBase

        schemas = {table.schema for table in SQLModelBase.metadata.tables.values()}
        self.assertEqual(schemas, {"public"})

    def test_every_table_is_registered_on_the_shared_metadata(self):
        from models.base import SQLModelBase

        self.assertIn("public.user", SQLModelBase.metadata.tables)
        self.assertIn("public.cached_course", SQLModelBase.metadata.tables)


class FailureMessageTests(unittest.TestCase):
    """A wrong setting should read as one line, not a driver stack."""

    def test_it_names_the_target_and_the_cause(self):
        exc = Exception()
        exc.orig = Exception("connection failed: FATAL:  password authentication failed\nmore noise")
        message = _failure_message(
            "postgresql+psycopg://u:p@db.example.com:6543/postgres", "parcourse", exc
        )
        self.assertIn("db.example.com:6543/postgres", message)
        self.assertIn("schema parcourse", message)
        self.assertIn("password authentication failed", message)
        self.assertNotIn("more noise", message)
        self.assertNotIn("p@", message)


if __name__ == "__main__":
    unittest.main()
