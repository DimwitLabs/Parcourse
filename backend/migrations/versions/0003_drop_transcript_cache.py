"""Stop keeping transcripts. Captions are the creator's, and holding a copy of
them bought a cache at the cost of storing work that is not ours.

Revision ID: 0003
Revises: 0002
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import sqlmodel

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_table("cached_transcript")


def downgrade() -> None:
    op.create_table(
        "cached_transcript",
        sa.Column("video_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("title", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("segments_json", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("chapters_json", sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default=""),
        sa.PrimaryKeyConstraint("video_id"),
    )
