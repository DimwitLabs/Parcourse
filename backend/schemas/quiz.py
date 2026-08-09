from typing import Literal

from pydantic import BaseModel


class MCQAnswer(BaseModel):
    question_id: str
    selected_label: str


class TheoryAnswer(BaseModel):
    question_id: str
    answer_text: str


class QuizSubmitRequest(BaseModel):
    course_id: str
    mcq_answers: list[MCQAnswer]
    theory_answers: list[TheoryAnswer]


class TheoryScoreBreakdown(BaseModel):
    accuracy: int
    completeness: int
    relevance: int
    feedback: str


class QuestionResult(BaseModel):
    question_id: str
    question_type: Literal["mcq", "theory"]
    is_correct: bool | None = None
    score: float
    max_score: float
    feedback: str
    breakdown: TheoryScoreBreakdown | None = None


class QuizResultResponse(BaseModel):
    course_id: str
    total_score: float
    max_score: float
    percentage: float
    results: list[QuestionResult]
