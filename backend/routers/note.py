import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from database import get_session
from dependencies import get_current_user
from models.course_cache import CachedCourse
from models.note import CourseNote
from models.user import User
from schemas.note import NoteResponse, NoteSaveRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notes", tags=["notes"])


def _owned_course(course_id: str, user: User, session: Session) -> uuid.UUID:
    try:
        course_uuid = uuid.UUID(course_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid course_id") from exc

    cached = session.get(CachedCourse, course_uuid)
    if cached is None or cached.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return course_uuid


@router.get("/{course_id}", response_model=NoteResponse)
def read_note(
    course_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> NoteResponse:
    course_uuid = _owned_course(course_id, user, session)
    note = session.get(CourseNote, course_uuid)
    if note is None:
        return NoteResponse(body="", updated_at=None)
    return NoteResponse(body=note.body, updated_at=note.updated_at)


@router.put("/{course_id}", response_model=NoteResponse)
def write_note(
    course_id: str,
    body: NoteSaveRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> NoteResponse:
    course_uuid = _owned_course(course_id, user, session)
    note = session.get(CourseNote, course_uuid)
    if note is None:
        note = CourseNote(course_id=course_uuid)
        session.add(note)

    note.body = body.body
    note.updated_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(note)
    logger.info("[notes]: saved course_id=%s for user %s", course_id, user.id)
    return NoteResponse(body=note.body, updated_at=note.updated_at)
