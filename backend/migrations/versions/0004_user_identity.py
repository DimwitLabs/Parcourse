"""Room for an account to sign in through an identity provider.

Revision ID: 0004
Revises: 0003
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import sqlmodel

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_identity",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("issuer", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("subject", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("issuer", "subject", name="uq_identity_issuer_subject"),
    )
    op.create_index("ix_user_identity_user_id", "user_identity", ["user_id"])
    op.create_index("ix_user_identity_issuer", "user_identity", ["issuer"])
    op.alter_column("user", "hashed_password", existing_type=sa.VARCHAR(), nullable=True)


def downgrade() -> None:
    op.execute("DELETE FROM \"user\" WHERE hashed_password IS NULL")
    op.alter_column("user", "hashed_password", existing_type=sa.VARCHAR(), nullable=False)
    op.drop_index("ix_user_identity_issuer", table_name="user_identity")
    op.drop_index("ix_user_identity_user_id", table_name="user_identity")
    op.drop_table("user_identity")
