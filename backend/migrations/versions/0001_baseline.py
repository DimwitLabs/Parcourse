"""The schema as create_all left it, before migrations existed. An install
from before Alembic is stamped here rather than running this.

Revision ID: 0001
Revises: 
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import sqlmodel

revision: str = '0001'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('cached_transcript',
    sa.Column('video_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('title', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('segments_json', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.PrimaryKeyConstraint('video_id')
    )
    op.create_table('instance_config',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('mode', sa.Enum('single', 'multi', name='instancemode'), nullable=False),
    sa.Column('default_connection', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('knowledge_node',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('tier', sa.Enum('field', 'topic', 'skill', name='nodetier'), nullable=False),
    sa.Column('label', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('label', 'tier', name='uq_knowledge_node_label_tier')
    )
    op.create_index(op.f('ix_knowledge_node_label'), 'knowledge_node', ['label'], unique=False)
    op.create_table('user',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('email', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('hashed_password', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('role', sa.Enum('admin', 'student', name='userrole'), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('first_name', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('last_name', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('connection', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('must_change_password', sa.Boolean(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_email'), 'user', ['email'], unique=True)
    op.create_table('cached_course',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('video_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('course_json', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_cached_course_user_id'), 'cached_course', ['user_id'], unique=False)
    op.create_index(op.f('ix_cached_course_video_id'), 'cached_course', ['video_id'], unique=False)
    op.create_table('knowledge_edge',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('source_id', sa.Uuid(), nullable=False),
    sa.Column('target_id', sa.Uuid(), nullable=False),
    sa.Column('edge_type', sa.Enum('belongs_to', 'related_to', 'prerequisite_of', name='edgetype'), nullable=False),
    sa.ForeignKeyConstraint(['source_id'], ['knowledge_node.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['target_id'], ['knowledge_node.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('source_id', 'target_id', 'edge_type', name='uq_knowledge_edge_source_target_type')
    )
    op.create_index(op.f('ix_knowledge_edge_source_id'), 'knowledge_edge', ['source_id'], unique=False)
    op.create_index(op.f('ix_knowledge_edge_target_id'), 'knowledge_edge', ['target_id'], unique=False)
    op.create_table('user_knowledge_progress',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('node_id', sa.Uuid(), nullable=False),
    sa.Column('mastery_score', sa.Float(), nullable=False),
    sa.Column('last_touched_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['node_id'], ['knowledge_node.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'node_id', name='uq_user_knowledge_progress_user_node')
    )
    op.create_index(op.f('ix_user_knowledge_progress_node_id'), 'user_knowledge_progress', ['node_id'], unique=False)
    op.create_index(op.f('ix_user_knowledge_progress_user_id'), 'user_knowledge_progress', ['user_id'], unique=False)
    op.create_table('cached_cheatsheet',
    sa.Column('course_id', sa.Uuid(), nullable=False),
    sa.Column('status', sa.Enum('pending', 'ready', 'failed', name='sheetstatus'), nullable=False),
    sa.Column('sheet_json', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['course_id'], ['cached_course.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('course_id')
    )
    op.create_table('course_knowledge_node',
    sa.Column('course_id', sa.Uuid(), nullable=False),
    sa.Column('node_id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['course_id'], ['cached_course.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['node_id'], ['knowledge_node.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('course_id', 'node_id')
    )
    op.create_table('quiz_attempt',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('course_id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('total_score', sa.Float(), nullable=False),
    sa.Column('max_score', sa.Float(), nullable=False),
    sa.Column('percentage', sa.Float(), nullable=False),
    sa.Column('result_json', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['course_id'], ['cached_course.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_quiz_attempt_course_id'), 'quiz_attempt', ['course_id'], unique=False)
    op.create_index(op.f('ix_quiz_attempt_user_id'), 'quiz_attempt', ['user_id'], unique=False)
    op.create_table('quiz_draft',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('course_id', sa.Uuid(), nullable=False),
    sa.Column('answers_json', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['course_id'], ['cached_course.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'course_id', name='uq_quiz_draft_user_course')
    )
    op.create_index(op.f('ix_quiz_draft_course_id'), 'quiz_draft', ['course_id'], unique=False)
    op.create_index(op.f('ix_quiz_draft_user_id'), 'quiz_draft', ['user_id'], unique=False)
    op.create_table('section_progress',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('course_id', sa.Uuid(), nullable=False),
    sa.Column('section_index', sa.Integer(), nullable=False),
    sa.Column('completed_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['course_id'], ['cached_course.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'course_id', 'section_index', name='uq_section_progress_user_course_section')
    )
    op.create_index(op.f('ix_section_progress_course_id'), 'section_progress', ['course_id'], unique=False)
    op.create_index(op.f('ix_section_progress_user_id'), 'section_progress', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_section_progress_user_id'), table_name='section_progress')
    op.drop_index(op.f('ix_section_progress_course_id'), table_name='section_progress')
    op.drop_table('section_progress')
    op.drop_index(op.f('ix_quiz_draft_user_id'), table_name='quiz_draft')
    op.drop_index(op.f('ix_quiz_draft_course_id'), table_name='quiz_draft')
    op.drop_table('quiz_draft')
    op.drop_index(op.f('ix_quiz_attempt_user_id'), table_name='quiz_attempt')
    op.drop_index(op.f('ix_quiz_attempt_course_id'), table_name='quiz_attempt')
    op.drop_table('quiz_attempt')
    op.drop_table('course_knowledge_node')
    op.drop_table('cached_cheatsheet')
    op.drop_index(op.f('ix_user_knowledge_progress_user_id'), table_name='user_knowledge_progress')
    op.drop_index(op.f('ix_user_knowledge_progress_node_id'), table_name='user_knowledge_progress')
    op.drop_table('user_knowledge_progress')
    op.drop_index(op.f('ix_knowledge_edge_target_id'), table_name='knowledge_edge')
    op.drop_index(op.f('ix_knowledge_edge_source_id'), table_name='knowledge_edge')
    op.drop_table('knowledge_edge')
    op.drop_index(op.f('ix_cached_course_video_id'), table_name='cached_course')
    op.drop_index(op.f('ix_cached_course_user_id'), table_name='cached_course')
    op.drop_table('cached_course')
    op.drop_index(op.f('ix_user_email'), table_name='user')
    op.drop_table('user')
    op.drop_index(op.f('ix_knowledge_node_label'), table_name='knowledge_node')
    op.drop_table('knowledge_node')
    op.drop_table('instance_config')
    op.drop_table('cached_transcript')
