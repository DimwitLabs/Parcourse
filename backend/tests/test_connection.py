"""Connection storage: what survives a round trip through the encrypted blob."""
import json
import unittest

from services.connection import Connection, deserialize, serialize
from services.crypto import encrypt


class DeserializeTests(unittest.TestCase):
    def test_reads_a_saved_connection(self):
        blob = serialize("ollama", "llama3.1", {"api_base": "http://localhost:11434"})
        self.assertEqual(
            deserialize(blob),
            Connection("ollama", "ollama/llama3.1", {"api_base": "http://localhost:11434"}),
        )

    def test_nothing_stored_is_no_connection(self):
        self.assertIsNone(deserialize(None))

    def test_an_unreadable_blob_fails_loudly(self):
        with self.assertRaises(ValueError):
            deserialize(encrypt(json.dumps({"model": "gpt-4o"})))
        with self.assertRaises(ValueError):
            deserialize(encrypt("not json at all"))

    def test_blank_credentials_do_not_count_as_configured(self):
        self.assertFalse(Connection("openai", "openai/gpt-4o", {"api_key": "  "}).has_credentials)


class SerializeTests(unittest.TestCase):
    def test_adds_the_provider_prefix_once(self):
        self.assertEqual(deserialize(serialize("openai", "gpt-4o", {"api_key": "k"})).model, "openai/gpt-4o")
        self.assertEqual(deserialize(serialize("openai", "openai/gpt-4o", {"api_key": "k"})).model, "openai/gpt-4o")

    def test_rejects_a_field_the_provider_does_not_have(self):
        with self.assertRaises(ValueError):
            serialize("openai", "gpt-4o", {"api_key": "k", "aws_region_name": "us-east-1"})

    def test_rejects_an_unknown_provider(self):
        with self.assertRaises(KeyError):
            serialize("not-a-provider", "x", {"api_key": "k"})

    def test_drops_blank_values(self):
        connection = deserialize(serialize("openai", "gpt-4o", {"api_key": "k"}))
        self.assertEqual(connection.credentials, {"api_key": "k"})


if __name__ == "__main__":
    unittest.main()
