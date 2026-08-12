import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

logger = logging.getLogger(__name__)

from database import get_session
from dependencies import get_current_user
from models.user import User
from schemas.guardrail import GuardrailRequest, GuardrailResult
from services.api_key import NoApiKeyError, resolve_api_key, resolve_model
from services.guardrail import classify

router = APIRouter(prefix="/guardrail", tags=["guardrail"])


@router.post("/check", response_model=GuardrailResult)
def check(
    body: GuardrailRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> GuardrailResult:
    logger.info("[guardrail]: check called, transcript length=%d", len(body.transcript))
    try:
        api_key = resolve_api_key(session, user)
    except NoApiKeyError as exc:
        logger.warning("[guardrail]: no API key for user %s", user.id)
        raise HTTPException(status_code=status.HTTP_412_PRECONDITION_FAILED, detail=str(exc)) from exc
    model = resolve_model(session)
    try:
        result = classify(body.transcript, api_key, model)
        logger.info("[guardrail]: classification result is_learnable=%s", result.is_learnable)
        return result
    except Exception as exc:
        logger.error("[guardrail]: AI provider request failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI provider request failed: {exc}"
        ) from exc
