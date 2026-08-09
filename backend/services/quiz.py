import json

import litellm

from config import settings
from schemas.course import CourseResponse
from schemas.quiz import MCQAnswer, QuestionResult, QuizResultResponse, TheoryAnswer, TheoryScoreBreakdown

_DIMENSIONS = [
    ("accuracy", "is what the student wrote factually correct? 5 = everything stated is correct, "
     "0 = what's stated is false or nonsensical."),
    ("completeness", "how much of the reference answer's key ideas are covered? 5 = all key ideas "
     "are covered, 0 = none of them are present."),
    ("relevance", "does the answer actually address the question asked? 5 = fully on-topic, "
     "0 = does not address the question at all."),
]

_DIMENSIONS_TEXT = "\n".join(f"- {name}: {description}" for name, description in _DIMENSIONS)

_THEORY_GRADE_PROMPT = """You are grading a student's answer to an open-ended question.

Question: {question}

Reference answer: {reference_answer}

Student's answer: {student_answer}

Score the student's answer on three dimensions, each from 0 to 5:
{dimensions}

Return only a JSON object with exactly these fields:
- "accuracy": integer 0-5
- "completeness": integer 0-5
- "relevance": integer 0-5
- "feedback": one or two sentences of specific, constructive feedback for the student, \
referencing what was correct or missing relative to the reference answer
"""


def _grade_theory(question: str, reference_answer: str, student_answer: str) -> TheoryScoreBreakdown:
    if not student_answer.strip():
        return TheoryScoreBreakdown(
            accuracy=0, completeness=0, relevance=0, feedback="No answer submitted."
        )

    prompt = _THEORY_GRADE_PROMPT.format(
        question=question,
        reference_answer=reference_answer,
        student_answer=student_answer,
        dimensions=_DIMENSIONS_TEXT,
    )
    response = litellm.completion(
        model=settings.ai_model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0,
    )
    data = json.loads(response.choices[0].message.content)
    return TheoryScoreBreakdown(**data)


def score_submission(
    course_id: str,
    course: CourseResponse,
    mcq_answers: list[MCQAnswer],
    theory_answers: list[TheoryAnswer],
) -> QuizResultResponse:
    mcq_lookup = {m.id: m for s in course.sections for m in s.mcqs}
    theory_lookup = {t.id: t for s in course.sections for t in s.theory_questions}

    results: list[QuestionResult] = []

    for answer in mcq_answers:
        question = mcq_lookup.get(answer.question_id)
        if question is None:
            continue
        is_correct = answer.selected_label == question.correct_label
        results.append(
            QuestionResult(
                question_id=question.id,
                question_type="mcq",
                is_correct=is_correct,
                score=1.0 if is_correct else 0.0,
                max_score=1.0,
                feedback=question.explanation,
            )
        )

    for answer in theory_answers:
        question = theory_lookup.get(answer.question_id)
        if question is None:
            continue
        breakdown = _grade_theory(question.question, question.reference_answer, answer.answer_text)
        average = round((breakdown.accuracy + breakdown.completeness + breakdown.relevance) / 3, 1)
        results.append(
            QuestionResult(
                question_id=question.id,
                question_type="theory",
                is_correct=None,
                score=average,
                max_score=5.0,
                feedback=breakdown.feedback,
                breakdown=breakdown,
            )
        )

    total_score = sum(r.score for r in results)
    max_score = sum(r.max_score for r in results)
    percentage = round((total_score / max_score * 100), 1) if max_score else 0.0

    return QuizResultResponse(
        course_id=course_id,
        total_score=total_score,
        max_score=max_score,
        percentage=percentage,
        results=results,
    )
