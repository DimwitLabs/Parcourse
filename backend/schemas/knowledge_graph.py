from typing import Literal

from pydantic import BaseModel

from models.knowledge_graph import EdgeType, NodeTier


class ExtractedNode(BaseModel):
    tier: NodeTier
    label: str
    description: str


class ExtractedEdge(BaseModel):
    source_label: str
    target_label: str
    edge_type: EdgeType


class Demotion(BaseModel):
    label: str
    field: str


class KnowledgeExtraction(BaseModel):
    nodes: list[ExtractedNode]
    edges: list[ExtractedEdge]
    demotions: list[Demotion] = []


class TidyRename(BaseModel):
    tier: NodeTier
    label: str
    to: str


class TidyMerge(BaseModel):
    tier: NodeTier
    label: str
    into: str


class TidySuggestion(BaseModel):
    summary: str
    renames: list[TidyRename] = []
    merges: list[TidyMerge] = []
    demotions: list[Demotion] = []


class TidyChange(BaseModel):
    kind: Literal["rename", "merge", "demote"]
    node_id: str
    tier: NodeTier
    label: str
    to: str
    into_id: str | None = None


class TidyProposal(BaseModel):
    summary: str
    changes: list[TidyChange]


class TidyApply(BaseModel):
    changes: list[TidyChange]


class TidyReply(BaseModel):
    feedback: str = ""
    previous: list[TidyChange] = []
    declined: list[TidyChange] = []


class CourseRef(BaseModel):
    id: str
    title: str


class NodeOut(BaseModel):
    id: str
    tier: NodeTier
    label: str
    description: str
    mastery_score: float
    courses: list[CourseRef] = []


class EdgeOut(BaseModel):
    source_id: str
    target_id: str
    edge_type: EdgeType


class KnowledgeGraphResponse(BaseModel):
    nodes: list[NodeOut]
    edges: list[EdgeOut]


class ForgottenNodes(BaseModel):
    forgotten: list[str]
