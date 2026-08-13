import json
import logging

import litellm

from config import settings
from schemas.guardrail import GuardrailResult

logger = logging.getLogger(__name__)

_PROMPT = """You are a strict content filter for a course-generation platform. \
Analyse the transcript and determine if this video would make a structured course \
with discrete, learnable concepts a student could recall and demonstrate.

Approve only if the content is primarily instructional: tutorials, lectures, \
explainers, or documentaries that convey concrete knowledge with clear structure.

Reject if the transcript primarily consists of: conversation between two or more \
people (interviews, podcasts, talk shows — even if intellectually interesting); \
motivational or inspirational speech without concrete technique; personal anecdotes \
or life stories; entertainment, music, gaming, comedy, or reaction content; news \
and opinion commentary.

The decisive test: could a student come away able to teach something specific to \
someone else? If the honest answer is "they'd be inspired but couldn't teach \
anything concrete," reject it.

Transcript excerpt:
\"\"\"
{excerpt}
\"\"\"

Return only a JSON object with exactly these fields:
- "is_learnable": boolean
- "reason": one sentence explaining the decision, starting with what type of content this is
"""


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
