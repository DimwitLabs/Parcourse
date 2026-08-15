import json
import logging
from typing import Any, Sequence

import litellm
from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)


class LLMJsonError(Exception):
    pass


def _capabilities(model: str, schema: type[BaseModel] | None) -> dict[str, Any]:
    """Pick the strongest JSON mode the model actually supports. Support varies
    per model rather than per provider, so it is asked at call time."""
    try:
        _, provider, _, _ = litellm.get_llm_provider(model=model)
    except Exception:
        logger.warning("[llm]: could not resolve provider for model=%s", model)
        return {}

    # supports_response_schema logs at ERROR when the answer is no.
    litellm_logger = logging.getLogger("LiteLLM")
    previous = litellm_logger.level
    litellm_logger.setLevel(logging.CRITICAL)
    try:
        if schema is not None and litellm.supports_response_schema(model, provider):
            logger.info("[llm]: model=%s supports response schema", model)
            return {"response_format": schema}
    except Exception:
        pass
    finally:
        litellm_logger.setLevel(previous)

    try:
        params = litellm.get_supported_openai_params(model=model) or []
    except Exception:
        params = []
    if "response_format" in params:
        logger.info("[llm]: model=%s supports json_object", model)
        return {"response_format": {"type": "json_object"}}

    logger.info("[llm]: model=%s has no JSON mode, falling back to the prompt", model)
    return {}


_JSON_INSTRUCTION = "\n\nReturn only the JSON object. No prose, no markdown, no code fences."


def _extract_json(text: str) -> str:
    """Models without a JSON mode wrap the object in prose or fences."""
    body = text.strip()
    if body.startswith("```"):
        body = body.split("```")[1] if "```" in body[3:] else body[3:]
        if body.lstrip().startswith("json"):
            body = body.lstrip()[4:]
        body = body.strip()
    start, end = body.find("{"), body.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise LLMJsonError("The model did not return a JSON object.")
    return body[start:end + 1]


def _validate(raw: str, schema: type[BaseModel] | None, required_keys: Sequence[str]) -> dict[str, Any]:
    data = json.loads(_extract_json(raw))
    if not isinstance(data, dict):
        raise LLMJsonError("The model returned JSON that is not an object.")
    if schema is not None:
        schema.model_validate(data)
    missing = [k for k in required_keys if k not in data]
    if missing:
        raise LLMJsonError(f"Missing required keys: {', '.join(missing)}")
    return data


def complete_json(
    *,
    model: str,
    api_key: str,
    prompt: str,
    schema: type[BaseModel] | None = None,
    required_keys: Sequence[str] = (),
    temperature: float = 0.0,
) -> dict[str, Any]:
    """Call the model and return a parsed, validated JSON object.

    Retries once with the parse error attached, which recovers the common case
    of a model that returns almost-right JSON when it has no schema mode."""
    kwargs = _capabilities(model, schema)
    text = prompt if kwargs else prompt + _JSON_INSTRUCTION
    messages: list[dict[str, str]] = [{"role": "user", "content": text}]

    logger.info("[llm]: calling model=%s json_mode=%s", model, kwargs.get("response_format", "prompt"))
    last_error: Exception | None = None
    for attempt in (1, 2):
        response = litellm.completion(
            model=model, messages=messages, temperature=temperature, api_key=api_key, **kwargs
        )
        raw = response.choices[0].message.content or ""
        usage = getattr(response, "usage", None)
        logger.info(
            "[llm]: completion done — prompt_tokens=%s completion_tokens=%s total_tokens=%s",
            getattr(usage, "prompt_tokens", "?"),
            getattr(usage, "completion_tokens", "?"),
            getattr(usage, "total_tokens", "?"),
        )
        try:
            return _validate(raw, schema, required_keys)
        except (json.JSONDecodeError, ValidationError, LLMJsonError) as exc:
            last_error = exc
            logger.warning("[llm]: attempt %d failed validation: %s", attempt, exc)
            messages += [
                {"role": "assistant", "content": raw},
                {"role": "user", "content": f"That failed to parse: {exc}.{_JSON_INSTRUCTION}"},
            ]

    logger.error("[llm]: model=%s returned unusable JSON after a retry: %s", model, last_error)
    raise LLMJsonError(
        f"{model} did not return usable JSON. Try a different model in Settings."
    ) from last_error
