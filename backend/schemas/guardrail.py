from pydantic import BaseModel


class GuardrailRequest(BaseModel):
    transcript: str


class GuardrailResult(BaseModel):
    is_learnable: bool
    reason: str
    fun_messages: list[str] = []
