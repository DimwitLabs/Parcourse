"""_store decides what survives an edit. A blank field means "keep it", and
getting that wrong destroys a key the user cannot retype."""
import unittest

from fastapi import HTTPException

from routers.settings import _store
from schemas.settings import ConnectionUpdateRequest
from services.connection import deserialize


def _request(provider: str, model: str, credentials: dict[str, str]) -> ConnectionUpdateRequest:
    return ConnectionUpdateRequest(provider=provider, model=model, credentials=credentials)


class StoreTests(unittest.TestCase):
    def test_blank_field_keeps_the_stored_value(self):
        existing = _store(_request("openai", "gpt-4o", {"api_key": "sk-real"}), None)
        updated = _store(_request("openai", "gpt-4o-mini", {"api_key": ""}), existing)
        self.assertEqual(deserialize(updated).credentials, {"api_key": "sk-real"})
        self.assertEqual(deserialize(updated).model, "openai/gpt-4o-mini")

    def test_editing_one_field_does_not_wipe_the_others(self):
        stored = {
            "api_key": "secret",
            "api_base": "https://old.openai.azure.com",
            "api_version": "2024-08-01-preview",
        }
        existing = _store(_request("azure", "gpt-4o", stored), None)
        updated = _store(
            _request(
                "azure",
                "gpt-4o",
                {"api_key": "", "api_base": "https://new.openai.azure.com", "api_version": ""},
            ),
            existing,
        )
        self.assertEqual(
            deserialize(updated).credentials,
            {**stored, "api_base": "https://new.openai.azure.com"},
        )

    def test_a_new_value_replaces_the_stored_one(self):
        existing = _store(_request("openai", "gpt-4o", {"api_key": "sk-old"}), None)
        updated = _store(_request("openai", "gpt-4o", {"api_key": "sk-new"}), existing)
        self.assertEqual(deserialize(updated).credentials, {"api_key": "sk-new"})

    def test_switching_provider_cannot_inherit_the_old_key(self):
        existing = _store(_request("openai", "gpt-4o", {"api_key": "sk-openai"}), None)
        with self.assertRaises(HTTPException) as caught:
            _store(_request("anthropic", "claude-sonnet-4", {"api_key": ""}), existing)
        self.assertEqual(caught.exception.status_code, 400)

    def test_nothing_stored_and_nothing_sent_is_rejected(self):
        with self.assertRaises(HTTPException) as caught:
            _store(_request("openai", "gpt-4o", {"api_key": ""}), None)
        self.assertEqual(caught.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
