"""Each person owns their own knowledge graph, with mastery kept on the concept.

Everyone gets a copy of the concepts they had progress in, along with the edges
between them and the links to their own courses. Concepts nobody had progress in
are dropped.

Revision ID: 0007
Revises: 0006
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("uq_knowledge_node_label_tier", "knowledge_node", type_="unique")
    op.add_column("knowledge_node", sa.Column("user_id", sa.Uuid(), nullable=True))
    op.add_column("knowledge_node", sa.Column("mastery_score", sa.Float(), nullable=False, server_default="0"))
    op.add_column("knowledge_node", sa.Column("last_touched_at", sa.DateTime(), nullable=True))
    op.add_column("knowledge_node", sa.Column("origin_id", sa.Uuid(), nullable=True))

    op.execute("""
        INSERT INTO knowledge_node (id, user_id, tier, label, description, mastery_score, last_touched_at, created_at, origin_id)
        SELECT gen_random_uuid(), p.user_id, n.tier, n.label, n.description, p.mastery_score, p.last_touched_at, n.created_at, n.id
        FROM user_knowledge_progress p JOIN knowledge_node n ON n.id = p.node_id
    """)
    op.execute("""
        INSERT INTO knowledge_edge (id, source_id, target_id, edge_type)
        SELECT gen_random_uuid(), s.id, t.id, e.edge_type
        FROM knowledge_edge e
        JOIN knowledge_node s ON s.origin_id = e.source_id
        JOIN knowledge_node t ON t.origin_id = e.target_id AND t.user_id = s.user_id
    """)
    op.execute("""
        INSERT INTO course_knowledge_node (course_id, node_id)
        SELECT l.course_id, n.id
        FROM course_knowledge_node l
        JOIN cached_course c ON c.id = l.course_id
        JOIN knowledge_node n ON n.origin_id = l.node_id AND n.user_id = c.user_id
    """)
    op.execute("DELETE FROM knowledge_node WHERE user_id IS NULL")

    op.drop_column("knowledge_node", "origin_id")
    op.drop_table("user_knowledge_progress")
    op.alter_column("knowledge_node", "user_id", nullable=False)
    op.alter_column("knowledge_node", "last_touched_at", nullable=False)
    op.alter_column("knowledge_node", "mastery_score", server_default=None)
    op.create_foreign_key("knowledge_node_user_id_fkey", "knowledge_node", "user", ["user_id"], ["id"], ondelete="CASCADE")
    op.create_index("ix_knowledge_node_user_id", "knowledge_node", ["user_id"])
    op.create_unique_constraint("uq_knowledge_node_user_label_tier", "knowledge_node", ["user_id", "label", "tier"])


def downgrade() -> None:
    op.create_table(
        "user_knowledge_progress",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("node_id", sa.Uuid(), nullable=False),
        sa.Column("mastery_score", sa.Float(), nullable=False),
        sa.Column("last_touched_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["node_id"], ["knowledge_node.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "node_id", name="uq_user_knowledge_progress_user_node"),
    )
    op.create_index("ix_user_knowledge_progress_node_id", "user_knowledge_progress", ["node_id"])
    op.create_index("ix_user_knowledge_progress_user_id", "user_knowledge_progress", ["user_id"])

    op.drop_constraint("uq_knowledge_node_user_label_tier", "knowledge_node", type_="unique")
    op.add_column("knowledge_node", sa.Column("shared_id", sa.Uuid(), nullable=True))
    op.execute("""
        UPDATE knowledge_node n SET shared_id = k.id
        FROM (SELECT DISTINCT ON (label, tier) id, label, tier FROM knowledge_node ORDER BY label, tier, created_at) k
        WHERE k.label = n.label AND k.tier = n.tier
    """)
    op.execute("""
        INSERT INTO user_knowledge_progress (id, user_id, node_id, mastery_score, last_touched_at)
        SELECT gen_random_uuid(), user_id, shared_id, max(mastery_score), max(last_touched_at)
        FROM knowledge_node GROUP BY user_id, shared_id
    """)
    op.execute("""
        INSERT INTO knowledge_edge (id, source_id, target_id, edge_type)
        SELECT gen_random_uuid(), s.shared_id, t.shared_id, e.edge_type
        FROM knowledge_edge e
        JOIN knowledge_node s ON s.id = e.source_id
        JOIN knowledge_node t ON t.id = e.target_id
        ON CONFLICT DO NOTHING
    """)
    op.execute("""
        INSERT INTO course_knowledge_node (course_id, node_id)
        SELECT l.course_id, n.shared_id
        FROM course_knowledge_node l JOIN knowledge_node n ON n.id = l.node_id
        ON CONFLICT DO NOTHING
    """)
    op.execute("DELETE FROM knowledge_node WHERE id <> shared_id")

    op.drop_column("knowledge_node", "shared_id")
    op.drop_index("ix_knowledge_node_user_id", table_name="knowledge_node")
    op.drop_constraint("knowledge_node_user_id_fkey", "knowledge_node", type_="foreignkey")
    op.drop_column("knowledge_node", "user_id")
    op.drop_column("knowledge_node", "mastery_score")
    op.drop_column("knowledge_node", "last_touched_at")
    op.create_unique_constraint("uq_knowledge_node_label_tier", "knowledge_node", ["label", "tier"])
