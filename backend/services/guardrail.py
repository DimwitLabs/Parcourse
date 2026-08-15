import logging

from schemas.guardrail import GuardrailResult
from services.llm import complete_json
from services.prompts import load

logger = logging.getLogger(__name__)

_PROMPT = load("guardrail")


def classify(transcript: str, credentials: dict[str, str], model: str) -> GuardrailResult:
    logger.info("[guardrail]: classifying transcript (length=%d)", len(transcript))
    prompt = _PROMPT.format(excerpt=transcript[:6000])

    logger.info("[guardrail]: classifying with model=%s", model)
    data = complete_json(
        model=model,
        credentials=credentials,
        prompt=prompt,
        schema=GuardrailResult,
        temperature=0,
    )
    result = GuardrailResult(**data)
    logger.info("[guardrail]: classification result is_learnable=%s, reason=%s", result.is_learnable, result.reason)
    return result
