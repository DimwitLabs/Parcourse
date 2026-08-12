import json

import litellm

from config import settings
from schemas.guardrail import GuardrailResult

_PROMPT = """You are a content classifier for an educational platform.

Given this transcript excerpt, decide whether the video is genuinely educational \
content (a tutorial, lecture, explainer, documentary, etc.) as opposed to music, \
comedy, vlogs, or other non-instructional content.

Transcript excerpt:
\"\"\"
{excerpt}
\"\"\"

Return only a JSON object with exactly these fields:
- "is_learnable": boolean
- "reason": one sentence explaining the decision
"""


def classify(transcript: str, api_key: str, model: str | None = None) -> GuardrailResult:
    prompt = _PROMPT.format(excerpt=transcript[:6000])

    response = litellm.completion(
        model=model or settings.ai_model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0,
        api_key=api_key,
    )
    raw = response.choices[0].message.content
    data = json.loads(raw)
    return GuardrailResult(**data)
