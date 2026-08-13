import json
import logging

import litellm

from config import settings
from schemas.guardrail import GuardrailResult
from services.prompts import load

logger = logging.getLogger(__name__)

_PROMPT = load("guardrail")


def classify(transcript: str, api_key: str, model: str | None = None) -> GuardrailResult:
    logger.info("[guardrail]: classifying transcript (length=%d)", len(transcript))
    prompt = _PROMPT.format(excerpt=transcript[:6000])

    used_model = model or settings.ai_model
    logger.info("[guardrail]: calling litellm.completion model=%s, api_key length=%d", used_model, len(api_key))
    response = litellm.completion(
        model=used_model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0,
        api_key=api_key,
    )
    raw = response.choices[0].message.content
    data = json.loads(raw)
    result = GuardrailResult(**data)
    logger.info("[guardrail]: classification result is_learnable=%s, reason=%s", result.is_learnable, result.reason)
    return result
