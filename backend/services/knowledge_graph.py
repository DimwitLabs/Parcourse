import logging
import uuid

from sqlmodel import Session, select


logger = logging.getLogger(__name__)
from models.knowledge_graph import (
    CourseKnowledgeNode,
    EdgeType,
    KnowledgeEdge,
    KnowledgeNode,
    NodeTier,
)
from schemas.course import CourseResponse
from schemas.knowledge_graph import KnowledgeExtraction
from services.llm import complete_json
from services.prompts import load

_EXTRACTION_PROMPT = load("knowledge_graph_extraction")
_EXPOSURE_MASTERY = 0.2


def _find(session: Session, user_id: uuid.UUID, tier: NodeTier, label: str) -> KnowledgeNode | None:
    return session.exec(
        select(KnowledgeNode).where(
            KnowledgeNode.user_id == user_id, KnowledgeNode.tier == tier, KnowledgeNode.label == label
        )
    ).first()


def _get_or_create_node(session: Session, user_id: uuid.UUID, tier: NodeTier, label: str, description: str = "") -> KnowledgeNode:
    node = _find(session, user_id, tier, label)
    if node:
        return node
    node = KnowledgeNode(
        user_id=user_id, tier=tier, label=label, description=description, mastery_score=_EXPOSURE_MASTERY
    )
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


def _fold(session: Session, kept: KnowledgeNode, gone: KnowledgeNode) -> None:
    """Moves everything attached to gone onto kept, then deletes gone. Kept holds
    on to the better of the two mastery scores."""
    kept.mastery_score = max(kept.mastery_score, gone.mastery_score)
    session.add(kept)

    for edge in session.exec(
        select(KnowledgeEdge).where((KnowledgeEdge.source_id == gone.id) | (KnowledgeEdge.target_id == gone.id))
    ).all():
        source = kept.id if edge.source_id == gone.id else edge.source_id
        target = kept.id if edge.target_id == gone.id else edge.target_id
        session.delete(edge)
        if source != target:
            _ensure_edge(session, source, target, edge.edge_type)

    for link in session.exec(select(CourseKnowledgeNode).where(CourseKnowledgeNode.node_id == gone.id)).all():
        session.delete(link)
        if session.get(CourseKnowledgeNode, (link.course_id, kept.id)) is None:
            session.add(CourseKnowledgeNode(course_id=link.course_id, node_id=kept.id))

    session.delete(gone)
    session.flush()


def demote(session: Session, user_id: uuid.UUID, label: str, broader_label: str, description: str = "") -> KnowledgeNode | None:
    """Turns an existing field into a topic under a broader field. The topics
    that belonged to it move up to the broader field, keeping a related_to edge
    back, since a topic cannot hold other topics. A topic of the same name
    already in the graph absorbs it."""
    field = _find(session, user_id, NodeTier.field, label)
    if field is None or label == broader_label:
        return None
    broader = _get_or_create_node(session, user_id, NodeTier.field, broader_label, description)

    for edge in session.exec(
        select(KnowledgeEdge).where(
            KnowledgeEdge.target_id == field.id, KnowledgeEdge.edge_type == EdgeType.belongs_to
        )
    ).all():
        session.delete(edge)
        _ensure_edge(session, edge.source_id, broader.id, EdgeType.belongs_to)
        _ensure_edge(session, edge.source_id, field.id, EdgeType.related_to)

    topic = _find(session, user_id, NodeTier.topic, label)
    if topic is None:
        field.tier = NodeTier.topic
        session.add(field)
        topic = field
    else:
        _fold(session, topic, field)

    _ensure_edge(session, topic.id, broader.id, EdgeType.belongs_to)
    session.flush()
    return topic


def _existing_labels(session: Session, user_id: uuid.UUID) -> str:
    nodes = session.exec(select(KnowledgeNode).where(KnowledgeNode.user_id == user_id)).all()
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
        sections_summary=sections_summary, existing_labels=_existing_labels(session, user_id)
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
    descriptions = {n.label: n.description for n in extraction.nodes}
    demoted = set()
    for d in extraction.demotions:
        if demote(session, user_id, d.label, d.field, descriptions.get(d.field, "")) is not None:
            demoted.add(d.label)
            logger.info("[knowledge_graph]: demoted field %r to a topic under %r", d.label, d.field)

    for n in extraction.nodes:
        tier = NodeTier.topic if n.label in demoted else n.tier
        label_to_node[n.label] = _get_or_create_node(session, user_id, tier, n.label, n.description)

    for e in extraction.edges:
        for lbl in (e.source_label, e.target_label):
            if lbl not in label_to_node:
                existing = session.exec(
                    select(KnowledgeNode).where(KnowledgeNode.user_id == user_id, KnowledgeNode.label == lbl)
                ).first()
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


def unlink_course(session: Session, user_id: uuid.UUID, course_id: uuid.UUID, forget_concepts: bool) -> None:
    """Takes a course's concepts out of the graph. With forget_concepts the user
    also loses the concepts no other course of theirs still reaches, which is
    what "forget this course entirely" means."""
    links = session.exec(select(CourseKnowledgeNode).where(CourseKnowledgeNode.course_id == course_id)).all()

    losing = set()
    if forget_concepts:
        for link in links:
            # A course the user still holds is the only thing keeping a concept alive.
            still_reached = session.exec(
                select(CourseKnowledgeNode.course_id).where(
                    CourseKnowledgeNode.node_id == link.node_id,
                    CourseKnowledgeNode.course_id != course_id,
                )
            ).first()
            if still_reached is None:
                losing.add(link.node_id)

    for link in links:
        session.delete(link)
    session.flush()

    if losing:
        owned = set(session.exec(select(KnowledgeNode.id).where(KnowledgeNode.user_id == user_id)).all())
        for node_id in losing - ancestors(session, owned - losing):
            node = session.get(KnowledgeNode, node_id)
            if node is not None:
                session.delete(node)
        session.flush()

