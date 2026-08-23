import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Column, ForeignKey
from sqlmodel import Field

from models.base import SQLModelBase


class SheetStatus(str, Enum):
    pending = "pending"
    ready = "ready"
    failed = "failed"


class CachedCheatsheet(SQLModelBase, table=True):
    """Written once per course and read many times, so it lives beside the
    course rather than inside it: the notebook lists courses whole, and a
    second large blob on that row would be carried by every listing."""

    course_id: uuid.UUID = Field(sa_column=Column(ForeignKey("cached_course.id", ondelete="CASCADE"), primary_key=True))
    status: SheetStatus = SheetStatus.pending
    sheet_json: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
