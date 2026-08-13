import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from database import get_session
from dependencies import get_current_user, require_admin
from models.course_cache import CachedCourse
from models.knowledge_graph import CourseKnowledgeNode, KnowledgeEdge, KnowledgeNode, UserKnowledgeProgress
from models.user import User
from schemas.knowledge_graph import CourseRef, EdgeOut, KnowledgeGraphResponse, NodeOut

router = APIRouter(prefix="/knowledge-graph", tags=["knowledge-graph"])


def _build_graph(session: Session, user_id: uuid.UUID) -> KnowledgeGraphResponse:
    progress_rows = session.exec(
        select(UserKnowledgeProgress).where(UserKnowledgeProgress.user_id == user_id)
    ).all()
    if not progress_rows:
        return KnowledgeGraphResponse(nodes=[], edges=[])

    progress_by_node = {p.node_id: p for p in progress_rows}
    node_ids = list(progress_by_node.keys())

    nodes = session.exec(select(KnowledgeNode).where(KnowledgeNode.id.in_(node_ids))).all()
    edges = session.exec(
        select(KnowledgeEdge).where(
            KnowledgeEdge.source_id.in_(node_ids), KnowledgeEdge.target_id.in_(node_ids)
        )
    ).all()

    node_ids = [n.id for n in nodes]
    links = session.exec(
        select(CourseKnowledgeNode).where(CourseKnowledgeNode.node_id.in_(node_ids))
    ).all()
    course_ids = list({lnk.course_id for lnk in links})
    courses = session.exec(select(CachedCourse).where(CachedCourse.id.in_(course_ids))).all()
    course_title: dict[uuid.UUID, str] = {}
    for c in courses:
        try:
            course_title[c.id] = json.loads(c.course_json).get("title", "Untitled")
        except Exception:
            course_title[c.id] = "Untitled"
    node_courses: dict[uuid.UUID, list[CourseRef]] = {n.id: [] for n in nodes}
    for lnk in links:
        if lnk.node_id in node_courses and lnk.course_id in course_title:
            node_courses[lnk.node_id].append(
                CourseRef(id=str(lnk.course_id), title=course_title[lnk.course_id])
            )

    return KnowledgeGraphResponse(
        nodes=[
            NodeOut(
                id=str(n.id),
                tier=n.tier,
                label=n.label,
                description=n.description,
                mastery_score=progress_by_node[n.id].mastery_score,
                times_encountered=progress_by_node[n.id].times_encountered,
                courses=node_courses.get(n.id, []),
            )
            for n in nodes
        ],
        edges=[
            EdgeOut(source_id=str(e.source_id), target_id=str(e.target_id), edge_type=e.edge_type)
            for e in edges
        ],
    )


@router.get("", response_model=KnowledgeGraphResponse)
def get_my_knowledge_graph(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> KnowledgeGraphResponse:
    return _build_graph(session, user.id)


@router.get("/users/{user_id}", response_model=KnowledgeGraphResponse)
def get_user_knowledge_graph(
    user_id: uuid.UUID,
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> KnowledgeGraphResponse:
    target = session.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _build_graph(session, target.id)
