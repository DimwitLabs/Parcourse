from datetime import datetime

from pydantic import BaseModel

from schemas.transcript import Chapter, TranscriptSegment


class CourseGenerateRequest(BaseModel):
    video_id: str
    video_title: str = ""
    channel: str = ""
    channel_url: str = ""
    feedback: str = ""
    segments: list[TranscriptSegment]
    chapters: list[Chapter] = []


class MCQOption(BaseModel):
    label: str
    text: str


class MCQQuestion(BaseModel):
    id: str
    question: str
    options: list[MCQOption]
    correct_label: str
    explanation: str


class TheoryQuestion(BaseModel):
    id: str
    question: str
    reference_answer: str


class CourseSection(BaseModel):
    title: str
    summary: str
    key_takeaways: list[str] = []
    start_seconds: float
    end_seconds: float
    mcqs: list[MCQQuestion]
    theory_questions: list[TheoryQuestion]


class CourseResponse(BaseModel):
    video_id: str
    video_title: str = ""
    channel: str = ""
    channel_url: str = ""
    thumbnail_url: str
    sections: list[CourseSection]


class MCQOptionPublic(BaseModel):
    label: str
    text: str


class MCQQuestionPublic(BaseModel):
    id: str
    question: str
    options: list[MCQOptionPublic]


class TheoryQuestionPublic(BaseModel):
    id: str
    question: str


class CourseSectionPublic(BaseModel):
    title: str
    summary: str
    key_takeaways: list[str] = []
    start_seconds: float
    end_seconds: float
    mcqs: list[MCQQuestionPublic]
    theory_questions: list[TheoryQuestionPublic]


class CourseResponsePublic(BaseModel):
    id: str
    video_id: str
    video_title: str = ""
    channel: str = ""
    channel_url: str = ""
    thumbnail_url: str
    sections: list[CourseSectionPublic]

    @classmethod
    def from_full(cls, course: CourseResponse, id: str) -> "CourseResponsePublic":
        return cls(
            id=id,
            video_id=course.video_id,
            video_title=course.video_title,
            channel=course.channel,
            channel_url=course.channel_url,
            thumbnail_url=course.thumbnail_url,
            sections=[
                CourseSectionPublic(
                    title=s.title,
                    summary=s.summary,
                    key_takeaways=s.key_takeaways,
                    start_seconds=s.start_seconds,
                    end_seconds=s.end_seconds,
                    mcqs=[
                        MCQQuestionPublic(
                            id=m.id,
                            question=m.question,
                            options=[MCQOptionPublic(**o.model_dump()) for o in m.options],
                        )
                        for m in s.mcqs
                    ],
                    theory_questions=[
                        TheoryQuestionPublic(id=t.id, question=t.question) for t in s.theory_questions
                    ],
                )
                for s in course.sections
            ],
        )


class CourseListEntry(BaseModel):
    id: str
    video_id: str
    video_title: str = ""
    thumbnail_url: str
    sections: list[CourseSectionPublic]
    completed_sections: list[int] = []
    has_passed_quiz: bool = False
    has_attempts: bool = False
    cheatsheet_status: str = "pending"
    created_at: datetime | None = None


class CheatsheetSection(BaseModel):
    title: str
    start_seconds: float
    points: list[str]


class CheatsheetResponse(BaseModel):
    status: str
    video_id: str = ""
    video_title: str = ""
    channel: str = ""
    channel_url: str = ""
    sections: list[CheatsheetSection] = []
