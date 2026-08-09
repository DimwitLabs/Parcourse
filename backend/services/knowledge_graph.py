import json
import uuid

import litellm
from sqlmodel import Session, select

from config import settings
from models.knowledge_graph import (
    CourseKnowledgeNode,
    EdgeType,
    KnowledgeEdge,
    KnowledgeNode,
    NodeTier,
    UserKnowledgeProgress,
)
from schemas.course import CourseResponse
from schemas.knowledge_graph import KnowledgeExtraction
from services.youtube_meta import get_video_category

_EXTRACTION_PROMPT = """You are extracting a knowledge graph from a course generated from a \
YouTube video.

Course sections:
{sections_summary}

Existing topics and skills already in the knowledge graph (reuse these exact labels if this \
course covers the same thing — do not create a near-duplicate with slightly different wording):
{existing_labels}

Extract the fields, topics, and skills this course teaches, at three levels:
- "field": a broad area within the domain (e.g., "Web Development", "Machine Learning")
- "topic": a more specific area within a field (e.g., "Control Flow", "Neural Networks")
- "skill": a single learnable/testable concept (e.g., "Ternary Operator", "Backpropagation") \
— this is the finest grain. Do not go smaller than this (e.g. not individual syntax tokens).

Return only a JSON object with exactly these fields:
- "nodes": a list of objects, each with "tier" ("field"/"topic"/"skill"), "label", \
"description" (one sentence)
- "edges": a list of objects, each with "source_label", "target_label", "edge_type" \
("belongs_to"/"related_to"/"prerequisite_of")

Rules:
- Prefer reusing an existing label over creating a new one if the concept is the same.
- Skill-tier labels should be as general/transferable as possible (e.g., "Ternary Operator", \
not "JavaScript Ternary Operator") unless the concept genuinely does not transfer across \
contexts (e.g., "Python List Comprehensions").
- Every skill must have a "belongs_to" edge to a topic, and every topic to a field.
"""

_EXPOSURE_MASTERY = 0.2


def _get_or_create_node(session: Session, tier: NodeTier, label: str, description: str = "") -> KnowledgeNode:
    node = session.exec(
        select(KnowledgeNode).where(KnowledgeNode.tier == tier, KnowledgeNode.label == label)
    ).first()
    if node:
        return node
    node = KnowledgeNode(tier=tier, label=label, description=description)
    session.add(node)
    session.flush()
    return node


def _ensure_edge(session: Session, source_id: uuid.UUID, target_id: uuid.UUID, edge_type: EdgeType) -> None:
    existing = session.exec(
        select(KnowledgeEdge).where(
            KnowledgeEdge.source_id == source_id,
            KnowledgeEdge.target_id == target_id,
            KnowledgeEdge.edge_type == edge_type,
        )
    ).first()
    if existing is None:
        session.add(KnowledgeEdge(source_id=source_id, target_id=target_id, edge_type=edge_type))


def _existing_labels(session: Session) -> str:
    nodes = session.exec(select(KnowledgeNode).where(KnowledgeNode.tier != NodeTier.domain)).all()
    if not nodes:
        return "(none yet)"
    return "\n".join(f"- [{n.tier.value}] {n.label}" for n in nodes)


def extract_and_merge(
    session: Session,
    user_id: uuid.UUID,
    course_id: uuid.UUID,
    course: CourseResponse,
    video_id: str,
) -> None:
    category = get_video_category(video_id) or "Education"
    domain = _get_or_create_node(session, NodeTier.domain, category, f"YouTube category: {category}")

    sections_summary = "\n".join(f"- {s.title}: {s.summary}" for s in course.sections)
    prompt = _EXTRACTION_PROMPT.format(
        sections_summary=sections_summary, existing_labels=_existing_labels(session)
    )
    response = litellm.completion(
        model=settings.ai_model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    data = json.loads(response.choices[0].message.content)
    extraction = KnowledgeExtraction(**data)

    label_to_node: dict[str, KnowledgeNode] = {domain.label: domain}
    for n in extraction.nodes:
        label_to_node[n.label] = _get_or_create_node(session, n.tier, n.label, n.description)

    for e in extraction.edges:
        source = label_to_node.get(e.source_label)
        target = label_to_node.get(e.target_label)
        if source is None or target is None:
            continue
        _ensure_edge(session, source.id, target.id, e.edge_type)

    # anchor top-level fields to the domain
    for n in extraction.nodes:
        if n.tier == NodeTier.field:
            _ensure_edge(session, label_to_node[n.label].id, domain.id, EdgeType.belongs_to)

    for node in label_to_node.values():
        if session.get(CourseKnowledgeNode, (course_id, node.id)) is None:
            session.add(CourseKnowledgeNode(course_id=course_id, node_id=node.id))

        progress = session.exec(
            select(UserKnowledgeProgress).where(
                UserKnowledgeProgress.user_id == user_id, UserKnowledgeProgress.node_id == node.id
            )
        ).first()
        if progress is None:
            session.add(
                UserKnowledgeProgress(
                    user_id=user_id, node_id=node.id, times_encountered=1, mastery_score=_EXPOSURE_MASTERY
                )
            )
        else:
            progress.times_encountered += 1
            session.add(progress)

    session.commit()
