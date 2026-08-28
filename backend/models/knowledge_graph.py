import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Column, ForeignKey, UniqueConstraint
from sqlmodel import Field

from models.base import SQLModelBase


class NodeTier(str, Enum):
    field = "field"
    topic = "topic"
    skill = "skill"


class EdgeType(str, Enum):
    belongs_to = "belongs_to"
    related_to = "related_to"
    prerequisite_of = "prerequisite_of"


class KnowledgeNode(SQLModelBase, table=True):
    __table_args__ = (UniqueConstraint("label", "tier", name="uq_knowledge_node_label_tier"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    tier: NodeTier
    label: str = Field(index=True)
    description: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class KnowledgeEdge(SQLModelBase, table=True):
    __table_args__ = (
        UniqueConstraint("source_id", "target_id", "edge_type", name="uq_knowledge_edge_source_target_type"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    source_id: uuid.UUID = Field(sa_column=Column(ForeignKey("knowledge_node.id", ondelete="CASCADE"), index=True, nullable=False))
    target_id: uuid.UUID = Field(sa_column=Column(ForeignKey("knowledge_node.id", ondelete="CASCADE"), index=True, nullable=False))
    edge_type: EdgeType


class CourseKnowledgeNode(SQLModelBase, table=True):
    course_id: uuid.UUID = Field(sa_column=Column(ForeignKey("cached_course.id", ondelete="CASCADE"), primary_key=True))
    node_id: uuid.UUID = Field(sa_column=Column(ForeignKey("knowledge_node.id", ondelete="CASCADE"), primary_key=True))


class UserKnowledgeProgress(SQLModelBase, table=True):
    __table_args__ = (UniqueConstraint("user_id", "node_id", name="uq_user_knowledge_progress_user_node"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(sa_column=Column(ForeignKey("user.id", ondelete="CASCADE"), index=True, nullable=False))
    node_id: uuid.UUID = Field(sa_column=Column(ForeignKey("knowledge_node.id", ondelete="CASCADE"), index=True, nullable=False))
    mastery_score: float = 0.0
    last_touched_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
