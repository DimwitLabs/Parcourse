from dataclasses import dataclass

from models.user import LearningStyle


@dataclass(frozen=True)
class Questions:
    mcqs: int
    theory: int


QUESTIONS = {
    LearningStyle.explorer: Questions(2, 1),
    LearningStyle.quick_study: Questions(4, 0),
    LearningStyle.deep_diver: Questions(1, 3),
    LearningStyle.storyteller: Questions(0, 4),
    LearningStyle.practitioner: Questions(3, 1),
    LearningStyle.exam_ready: Questions(4, 4),
}


def _count(n: int, one: str, many: str) -> str:
    return f"exactly {n} {one if n == 1 else many}"


def questions_line(questions: Questions) -> str:
    asked = [
        _count(questions.mcqs, "multiple-choice question", "multiple-choice questions") if questions.mcqs else "",
        _count(questions.theory, "open-ended theory question", "open-ended theory questions") if questions.theory else "",
    ]
    wanted = " and ".join(part for part in asked if part)
    return f"For each section also write {wanted} that test understanding of that section's content."


def list_of(n: int) -> str:
    if n == 0:
        return "always an empty list [], so none of the fields below are written"
    return f"a list of {_count(n, 'object', 'objects')}, each with"
