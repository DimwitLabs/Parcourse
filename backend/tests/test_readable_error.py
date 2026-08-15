"""Provider failures reach the user through _readable_error, so each LiteLLM
error class needs to come out as something a person can act on."""
import unittest

import litellm

from routers.settings import _readable_error

MODEL = "openrouter/openai/gpt-4o-mini"


def _raise(kind: type[Exception], message: str) -> Exception:
    """LiteLLM errors need provider metadata, so build them the way it does."""
    return kind(message=message, model=MODEL, llm_provider="openrouter")


class ReadableErrorTests(unittest.TestCase):
    def test_rejected_credentials(self):
        detail = _readable_error(_raise(litellm.AuthenticationError, "invalid api key"), MODEL)
        self.assertIn("credentials were rejected", detail)

    def test_unknown_model_names_the_model(self):
        detail = _readable_error(_raise(litellm.NotFoundError, "no such model"), MODEL)
        self.assertIn(MODEL, detail)
        self.assertIn("model ID", detail)

    def test_rate_limit(self):
        self.assertIn("rate limiting", _readable_error(_raise(litellm.RateLimitError, "slow down"), MODEL))

    def test_unreachable_host(self):
        detail = _readable_error(litellm.APIConnectionError(message="refused", model=MODEL, llm_provider="ollama"), MODEL)
        self.assertIn("Could not reach", detail)

    def test_unknown_error_falls_back_to_the_provider_message(self):
        detail = _readable_error(RuntimeError("Error code: 400 - {'error': {'message': 'bad thing', 'code': 400}}"), MODEL)
        self.assertEqual(detail, "bad thing")

    def test_unparseable_error_still_says_something(self):
        detail = _readable_error(RuntimeError("total nonsense"), MODEL)
        self.assertIn("RuntimeError", detail)

    def test_never_leaks_the_whole_envelope(self):
        raw = "Error code: 400 - {'error': {'message': 'nope', 'code': 400}, 'user_id': 'user_secret'}"
        self.assertNotIn("user_secret", _readable_error(RuntimeError(raw), MODEL))


if __name__ == "__main__":
    unittest.main()
