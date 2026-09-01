import logging
import uuid

from sqlmodel import Session, select


logger = logging.getLogger(__name__)
from models.course_cache import CachedCourse
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
from services.llm import complete_json
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
    nodes = session.exec(select(KnowledgeNode)).all()
    if not nodes:
        return "(none yet)"
    return "\n".join(f"- [{n.tier.value}] {n.label}" for n in nodes)


def extract_and_merge(
    session: Session,
    user_id: uuid.UUID,
    course_id: uuid.UUID,
    course: CourseResponse,
    video_id: str,
    credentials: dict[str, str],
    model: str,
) -> None:
    logger.info("[knowledge_graph]: extracting and merging for course %s, user %s, video %s", course_id, user_id, video_id)

    sections_summary = "\n".join(f"- {s.title}: {s.summary}" for s in course.sections)
    prompt = _EXTRACTION_PROMPT.format(
        sections_summary=sections_summary, existing_labels=_existing_labels(session)
    )
    logger.info("[knowledge_graph]: extracting with model=%s", model)
    data = complete_json(
        model=model,
        credentials=credentials,
        prompt=prompt,
        schema=KnowledgeExtraction,
        temperature=0.2,
    )
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
                UserKnowledgeProgress(user_id=user_id, node_id=node.id, mastery_score=_EXPOSURE_MASTERY)
            )

    session.commit()
    logger.info("[knowledge_graph]: merged %d nodes and %d edges for course %s", len(extraction.nodes), len(extraction.edges), course_id)


def ancestors(session: Session, nodes: set[uuid.UUID]) -> set[uuid.UUID]:
    """Everything the given concepts hang from. A skill outlives its course when
    another one teaches it, and removing the topic it belongs to would leave it
    floating with nothing to join it to the rest."""
    reached = set(nodes)
    frontier = set(nodes)
    while frontier:
        above = session.exec(
            select(KnowledgeEdge.target_id).where(
                KnowledgeEdge.source_id.in_(frontier),
                KnowledgeEdge.edge_type == EdgeType.belongs_to,
            )
        ).all()
        frontier = set(above) - reached
        reached |= frontier
    return reached


def falling(session: Session, node_id: uuid.UUID, owned: set[uuid.UUID]) -> set[uuid.UUID]:
    """This concept, plus everything that only reaches the graph through it. A
    concept that also belongs to one being kept stays where it is."""
    edges = session.exec(
        select(KnowledgeEdge).where(
            KnowledgeEdge.source_id.in_(owned),
            KnowledgeEdge.target_id.in_(owned),
            KnowledgeEdge.edge_type == EdgeType.belongs_to,
        )
    ).all()
    parents: dict[uuid.UUID, set[uuid.UUID]] = {}
    children: dict[uuid.UUID, set[uuid.UUID]] = {}
    for edge in edges:
        parents.setdefault(edge.source_id, set()).add(edge.target_id)
        children.setdefault(edge.target_id, set()).add(edge.source_id)

    going = {node_id}
    frontier = {node_id}
    while frontier:
        below = set().union(*(children.get(n, set()) for n in frontier))
        frontier = below - going
        going |= frontier

    spared = True
    while spared:
        spared = False
        for candidate in going - {node_id}:
            if parents.get(candidate, set()) - going:
                going.discard(candidate)
                spared = True
                break
    return going


def unlink_course(session: Session, user_id: uuid.UUID, course_id: uuid.UUID, prune_mastery: bool) -> None:
    """Takes a course's concepts out of the graph. With prune_mastery the user
    also loses standing in concepts no other course of theirs still reaches,
    which is what "forget this course entirely" means."""
    links = session.exec(select(CourseKnowledgeNode).where(CourseKnowledgeNode.course_id == course_id)).all()

    if prune_mastery:
        losing = set()
        for link in links:
            # A course the user still holds is the only thing keeping a
            # concept alive, so ask that rather than keeping a tally.
            still_reached = session.exec(
                select(CourseKnowledgeNode.course_id)
                .join(CachedCourse, CachedCourse.id == CourseKnowledgeNode.course_id)
                .where(
                    CourseKnowledgeNode.node_id == link.node_id,
                    CourseKnowledgeNode.course_id != course_id,
                    CachedCourse.user_id == user_id,
                )
            ).first()
            if still_reached is None:
                losing.add(link.node_id)

        owned = {
            p.node_id: p
            for p in session.exec(
                select(UserKnowledgeProgress).where(UserKnowledgeProgress.user_id == user_id)
            ).all()
        }
        for node_id in losing - ancestors(session, set(owned) - losing):
            progress = owned.get(node_id)
            if progress is not None:
                session.delete(progress)
        session.flush()

    for link in links:
        session.delete(link)
    session.flush()
