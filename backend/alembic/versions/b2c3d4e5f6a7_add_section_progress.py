"""add section_progress table

Revision ID: b2c3d4e5f6a7
Revises: 29995e9f03bb
Create Date: 2026-08-12
"""
from alembic import op
import sqlalchemy as sa

revision = "b2c3d4e5f6a7"
down_revision = "b3a7d9f12e01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sectionprogress",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("course_id", sa.Uuid(), sa.ForeignKey("cachedcourse.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("section_index", sa.Integer(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "course_id", "section_index", name="uq_sectionprogress_user_course_section"),
    )


def downgrade() -> None:
    op.drop_table("sectionprogress")
