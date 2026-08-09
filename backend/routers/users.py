from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, func, select

from database import get_session
from dependencies import require_admin
from models.course_cache import CachedCourse
from models.user import User, UserRole
from schemas.auth import CreateUserRequest, UserResponse, UserWithUsage
from services.auth import hash_password

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    body: CreateUserRequest,
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> UserResponse:
    if session.exec(select(User).where(User.email == body.email)).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")

    user = User(email=body.email, hashed_password=hash_password(body.password), role=UserRole.student)
    session.add(user)
    session.commit()
    session.refresh(user)
    return UserResponse(**user.model_dump())


@router.get("", response_model=list[UserWithUsage])
def list_users(
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> list[UserWithUsage]:
    users = session.exec(select(User)).all()
    counts = dict(
        session.exec(
            select(CachedCourse.user_id, func.count()).group_by(CachedCourse.user_id)
        ).all()
    )
    return [
        UserWithUsage(**u.model_dump(), course_count=counts.get(u.id, 0))
        for u in users
    ]
