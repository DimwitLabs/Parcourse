from fastapi import APIRouter, Depends, HTTPException, status

from dependencies import get_current_user
from models.user import User
from schemas.guardrail import GuardrailRequest, GuardrailResult
from services.guardrail import classify

router = APIRouter(prefix="/guardrail", tags=["guardrail"])


@router.post("/check", response_model=GuardrailResult)
def check(body: GuardrailRequest, _: User = Depends(get_current_user)) -> GuardrailResult:
    try:
        return classify(body.transcript)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI provider request failed: {exc}"
        ) from exc
