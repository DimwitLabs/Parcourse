"""A sheet of notes per course, and the creator's chapters beside the transcript.

Revision ID: 0002
Revises: 0001
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import sqlmodel

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "course_note",
        sa.Column("course_id", sa.Uuid(), nullable=False),
        sa.Column("body", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["course_id"], ["cached_course.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("course_id"),
    )
    # Transcripts stored before this column carry "", which reads back as a
    # video whose chapters were never looked for.
    op.add_column(
        "cached_transcript",
        sa.Column(
            "chapters_json",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=False,
            server_default="",
        ),
    )


def downgrade() -> None:
    op.drop_column("cached_transcript", "chapters_json")
    op.drop_table("course_note")
