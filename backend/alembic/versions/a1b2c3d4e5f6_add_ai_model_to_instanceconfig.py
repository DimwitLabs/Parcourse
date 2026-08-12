"""add ai_model to instanceconfig

Revision ID: a1b2c3d4e5f6
Revises: e0c9b5abf9b5
Create Date: 2026-08-12 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


revision = 'a1b2c3d4e5f6'
down_revision = 'e0c9b5abf9b5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('instanceconfig', sa.Column('ai_model', sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default='openrouter/openai/gpt-4o-mini'))


def downgrade() -> None:
    op.drop_column('instanceconfig', 'ai_model')
