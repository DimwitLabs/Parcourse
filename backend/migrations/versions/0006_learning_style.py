"""Each person picks the mix of questions their courses ask.

Revision ID: 0006
Revises: 0005
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

learning_style = sa.Enum(
    "explorer", "quick_study", "deep_diver", "storyteller", "practitioner", "exam_ready",
    name="learningstyle",
)


def upgrade() -> None:
    learning_style.create(op.get_bind(), checkfirst=True)
    op.add_column("user", sa.Column("learning_style", learning_style, nullable=False, server_default="explorer"))


def downgrade() -> None:
    op.drop_column("user", "learning_style")
    learning_style.drop(op.get_bind(), checkfirst=True)
