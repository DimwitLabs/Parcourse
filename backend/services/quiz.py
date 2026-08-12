import json
import logging

import litellm

from config import settings
from schemas.course import CourseResponse
from schemas.quiz import MCQAnswer, QuestionResult, QuizResultResponse, TheoryAnswer, TheoryScoreBreakdown

logger = logging.getLogger(__name__)

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
referencing what was correct or missing relative to the reference answer. \
Never use em dashes; use commas, periods, or semicolons instead
"""


def _grade_theory(
    question: str, reference_answer: str, student_answer: str, api_key: str, model: str | None = None
) -> TheoryScoreBreakdown:
    if not student_answer.strip():
        logger.info("[quiz]: empty answer submitted, returning zero scores")
        return TheoryScoreBreakdown(
            accuracy=0, completeness=0, relevance=0, feedback="No answer submitted."
        )

    used_model = model or settings.ai_model
    logger.info("[quiz]: grading theory answer, model=%s, api_key length=%d", used_model, len(api_key))
    prompt = _THEORY_GRADE_PROMPT.format(
        question=question,
        reference_answer=reference_answer,
        student_answer=student_answer,
        dimensions=_DIMENSIONS_TEXT,
    )
    response = litellm.completion(
        model=used_model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0,
        api_key=api_key,
    )
    logger.info("[quiz]: theory grading litellm.completion succeeded")
    data = json.loads(response.choices[0].message.content)
    if "feedback" in data:
        data["feedback"] = data["feedback"].replace("—", ",").replace("–", ",")
    return TheoryScoreBreakdown(**data)


_PROSE_ANALYSIS_PROMPT = """You are a thoughtful tutor reviewing a student's quiz performance on a course.

Course topic context (section titles):
{section_titles}

Quiz results summary:
{results_summary}

Questions attempted: {answered_count} of {total_count} total.

Write 2-3 sentences of personalised feedback addressed directly to the student ("you").
Focus on which CONCEPTS or TOPICS they engaged with, and which specific areas they should revisit — using the actual subject matter from the section titles, not just numbers.
Be warm but honest. If most questions were skipped or unanswered, acknowledge that honestly and encourage them to try more questions before drawing conclusions.
Only use positive praise like "strong understanding" or "great grasp" when the results genuinely show it. If the attempt was incomplete or mostly incorrect, be supportive but truthful.
Do not mention scores or percentages.
Never use em dashes; use commas, periods, or semicolons instead.
Return only the plain prose text, no JSON, no quotes, no labels."""


def _generate_prose_analysis(
    section_titles: list[str],
    results_summary: str,
    answered_count: int,
    total_count: int,
    api_key: str,
    model: str | None = None,
) -> str:
    used_model = model or settings.ai_model
    logger.info("[quiz]: generating prose analysis, model=%s", used_model)
    prompt = _PROSE_ANALYSIS_PROMPT.format(
        section_titles="\n".join(f"- {t}" for t in section_titles),
        results_summary=results_summary,
        answered_count=answered_count,
        total_count=total_count,
    )
    try:
        response = litellm.completion(
            model=used_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            api_key=api_key,
        )
        text = response.choices[0].message.content.strip().strip('"')
        return text.replace("—", ",").replace("–", ",")
    except Exception as exc:
        logger.warning("[quiz]: prose analysis generation failed: %s", exc)
        return ""


def score_submission(
    course_id: str,
    course: CourseResponse,
    mcq_answers: list[MCQAnswer],
    theory_answers: list[TheoryAnswer],
    api_key: str,
    model: str | None = None,
) -> QuizResultResponse:
    logger.info("[quiz]: scoring submission for course %s (%d MCQs, %d theory answers)", course_id, len(mcq_answers), len(theory_answers))
    mcq_answer_lookup = {a.question_id: a for a in mcq_answers}
    theory_answer_lookup = {a.question_id: a for a in theory_answers}

    results: list[QuestionResult] = []

    for section in course.sections:
        for question in section.mcqs:
            answer = mcq_answer_lookup.get(question.id)
            if answer is None:
                results.append(QuestionResult(
                    question_id=question.id, question_type="mcq",
                    is_correct=False, score=0.0, max_score=1.0,
                    feedback="Question was skipped.",
                ))
                continue
            is_correct = answer.selected_label == question.correct_label
            results.append(QuestionResult(
                question_id=question.id, question_type="mcq",
                is_correct=is_correct,
                score=1.0 if is_correct else 0.0, max_score=1.0,
                feedback=question.explanation,
            ))

        for question in section.theory_questions:
            answer = theory_answer_lookup.get(question.id)
            if answer is None or not answer.answer_text.strip():
                results.append(QuestionResult(
                    question_id=question.id, question_type="theory",
                    is_correct=None, score=0.0, max_score=5.0,
                    feedback="Question was skipped.",
                ))
                continue
            breakdown = _grade_theory(question.question, question.reference_answer, answer.answer_text, api_key, model)
            average = round((breakdown.accuracy + breakdown.completeness + breakdown.relevance) / 3, 1)
            results.append(QuestionResult(
                question_id=question.id, question_type="theory",
                is_correct=None, score=average, max_score=5.0,
                feedback=breakdown.feedback, breakdown=breakdown,
            ))

    total_score = sum(r.score for r in results)
    max_score = sum(r.max_score for r in results)
    percentage = round((total_score / max_score * 100), 1) if max_score else 0.0

    question_lookup: dict[str, str] = {}
    for section in course.sections:
        for q in section.mcqs:
            question_lookup[q.id] = q.question
        for q in section.theory_questions:
            question_lookup[q.id] = q.question

    summary_lines = []
    for r in results:
        q_text = question_lookup.get(r.question_id, "Unknown question")
        skipped = r.feedback == "Question was skipped."
        if r.question_type == "mcq":
            status = "skipped" if skipped else ("correct" if r.is_correct else "incorrect")
        else:
            status = "skipped" if skipped else f"scored {r.score:.1f}/5"
        summary_lines.append(f"- [{status}] {q_text}")

    section_titles = [s.title for s in course.sections]
    answered_count = sum(1 for r in results if r.feedback != "Question was skipped.")
    if answered_count == 0:
        prose_analysis = ""
    else:
        prose_analysis = _generate_prose_analysis(section_titles, "\n".join(summary_lines), answered_count, len(results), api_key, model)

    logger.info("[quiz]: scoring complete for course %s — %.1f/%.1f (%.1f%%)", course_id, total_score, max_score, percentage)
    return QuizResultResponse(
        course_id=course_id,
        total_score=total_score,
        max_score=max_score,
        percentage=percentage,
        results=results,
        prose_analysis=prose_analysis,
    )
