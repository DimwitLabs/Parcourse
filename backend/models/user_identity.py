import uuid
from datetime import datetime, timezone

from sqlmodel import Field, UniqueConstraint

from models.base import SQLModelBase


class UserIdentity(SQLModelBase, table=True):
    """An account at an identity provider, linked to a local user.
    The pair that names it is the issuer and the subject, because those are the
    only two an OIDC provider promises never to reuse or reassign. An email
    address is neither: people change theirs, and a provider can hand a freed
    one to someone else."""

    __table_args__ = (UniqueConstraint("issuer", "subject", name="uq_identity_issuer_subject"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    issuer: str = Field(index=True)
    subject: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
