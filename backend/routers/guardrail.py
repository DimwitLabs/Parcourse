from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

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
    try:
        api_key = resolve_api_key(session, user)
    except NoApiKeyError as exc:
        raise HTTPException(status_code=status.HTTP_412_PRECONDITION_FAILED, detail=str(exc)) from exc
    model = resolve_model(session)
    try:
        return classify(body.transcript, api_key, model)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI provider request failed: {exc}"
        ) from exc
