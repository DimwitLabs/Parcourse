import json
import logging
import uuid

import litellm
from sqlmodel import Session, select

from config import settings

logger = logging.getLogger(__name__)
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
from services.prompts import load

_EXTRACTION_PROMPT = load("knowledge_graph_extraction")

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
    api_key: str,
    model: str | None = None,
) -> None:
    logger.info("[knowledge_graph]: extracting and merging for course %s, user %s, video %s", course_id, user_id, video_id)

    sections_summary = "\n".join(f"- {s.title}: {s.summary}" for s in course.sections)
    prompt = _EXTRACTION_PROMPT.format(
        sections_summary=sections_summary, existing_labels=_existing_labels(session)
    )
    used_model = model or settings.ai_model
    logger.info("[knowledge_graph]: calling litellm.completion model=%s, api_key length=%d", used_model, len(api_key))
    response = litellm.completion(
        model=used_model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.2,
        api_key=api_key,
    )
    usage = getattr(response, "usage", None)
    logger.info("[knowledge_graph]: litellm.completion succeeded, tokens=%s", usage if usage else "N/A")
    data = json.loads(response.choices[0].message.content)
    extraction = KnowledgeExtraction(**data)

    label_to_node: dict[str, KnowledgeNode] = {}
    for n in extraction.nodes:
        label_to_node[n.label] = _get_or_create_node(session, n.tier, n.label, n.description)

    for e in extraction.edges:
        for lbl in (e.source_label, e.target_label):
            if lbl not in label_to_node:
                existing = session.exec(select(KnowledgeNode).where(KnowledgeNode.label == lbl)).first()
                if existing:
                    label_to_node[lbl] = existing

    for e in extraction.edges:
        source = label_to_node.get(e.source_label)
        target = label_to_node.get(e.target_label)
        if source is None or target is None:
            continue
        _ensure_edge(session, source.id, target.id, e.edge_type)

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
    logger.info("[knowledge_graph]: merged %d nodes and %d edges for course %s", len(extraction.nodes), len(extraction.edges), course_id)
