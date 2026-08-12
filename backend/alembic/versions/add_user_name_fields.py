"""add user name fields

Revision ID: b3a7d9f12e01
Revises: e0c9b5abf9b5
Create Date: 2026-08-12 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


revision = 'b3a7d9f12e01'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('user', sa.Column('first_name', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column('user', sa.Column('last_name', sqlmodel.sql.sqltypes.AutoString(), nullable=True))


def downgrade() -> None:
    op.drop_column('user', 'last_name')
    op.drop_column('user', 'first_name')
