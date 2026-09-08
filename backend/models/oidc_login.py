import uuid
from datetime import datetime, timezone

from sqlmodel import Field

from models.base import SQLModelBase


class OidcLogin(SQLModelBase, table=True):
    """A sign-in that has been sent to the provider and not come back yet.

    The state is what proves the browser arriving at the callback is the one
    that started, and the verifier is the PKCE secret that proves the code
    being exchanged was issued to this attempt. Both are useless afterwards,
    so a row is deleted the moment it is used."""

    state: str = Field(primary_key=True)
    code_verifier: str
    nonce: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
