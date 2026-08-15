import logging

from config import settings
from schemas.guardrail import GuardrailResult
from services.llm import complete_json
from services.prompts import load

logger = logging.getLogger(__name__)

_PROMPT = load("guardrail")


def classify(transcript: str, credentials: dict[str, str], model: str | None = None) -> GuardrailResult:
    logger.info("[guardrail]: classifying transcript (length=%d)", len(transcript))
    prompt = _PROMPT.format(excerpt=transcript[:6000])

    used_model = model or settings.ai_model
    logger.info("[guardrail]: classifying with model=%s", used_model)
    data = complete_json(
        model=used_model,
        credentials=credentials,
        prompt=prompt,
        schema=GuardrailResult,
        temperature=0,
    )
    result = GuardrailResult(**data)
    logger.info("[guardrail]: classification result is_learnable=%s, reason=%s", result.is_learnable, result.reason)
    return result
