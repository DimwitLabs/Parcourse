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


class KnowledgeExtraction(BaseModel):
    nodes: list[ExtractedNode]
    edges: list[ExtractedEdge]


class CourseRef(BaseModel):
    id: str
    title: str


class NodeOut(BaseModel):
    id: str
    tier: NodeTier
    label: str
    description: str
    mastery_score: float
    times_encountered: int
    courses: list[CourseRef] = []


class EdgeOut(BaseModel):
    source_id: str
    target_id: str
    edge_type: EdgeType


class KnowledgeGraphResponse(BaseModel):
    nodes: list[NodeOut]
    edges: list[EdgeOut]
