"""A learning style sets how many of each question a section asks. Every style
asks a different mix, so no two styles quiz a learner the same way.
"""

import unittest

from models.user import LearningStyle
from schemas.course import CourseResponse
from services.learning_style import QUESTIONS, list_of, questions_line
from services.prompts import load


def course_prompt(style):
    questions = QUESTIONS[style]
    return load("course").format(
        boundaries_block="", title_block="", feedback_block="", formatted="",
        total_seconds=0.0, total_minutes=0.0, questions=questions_line(questions),
        mcqs=list_of(questions.mcqs), theory=list_of(questions.theory),
    )


class QuestionTests(unittest.TestCase):
    def test_every_style_has_a_mix(self):
        self.assertEqual(set(QUESTIONS), set(LearningStyle))

    def test_no_two_styles_ask_the_same_mix(self):
        mixes = [(q.mcqs, q.theory) for q in QUESTIONS.values()]
        self.assertEqual(len(mixes), len(set(mixes)))

    def test_every_style_asks_something(self):
        for questions in QUESTIONS.values():
            self.assertGreater(questions.mcqs + questions.theory, 0)

    def test_a_style_without_one_kind_does_not_ask_for_it(self):
        line = questions_line(QUESTIONS[LearningStyle.storyteller])
        self.assertIn("exactly 4 open-ended theory questions", line)
        self.assertNotIn("multiple-choice", line)


class PromptTests(unittest.TestCase):
    def test_the_prompt_asks_for_the_style_mix(self):
        course = course_prompt(LearningStyle.quick_study)
        self.assertIn("exactly 4 multiple-choice questions that test", course)
        self.assertIn('"mcqs": a list of exactly 4 objects, each with:', course)
        self.assertIn('"theory_questions": always an empty list []', course)

    def test_the_writing_is_the_same_for_every_style(self):
        for style in LearningStyle:
            course = course_prompt(style)
            self.assertIn('"summary": str, 2-3 sentences', course)
            self.assertIn("a list of 2-4 short phrases (3-6 words each)", course)


class StoredCourseTests(unittest.TestCase):
    def test_a_course_made_before_styles_reads_as_explorer(self):
        course = CourseResponse.model_validate({"video_id": "abc", "thumbnail_url": "", "sections": []})
        self.assertIs(course.style, LearningStyle.explorer)


if __name__ == "__main__":
    unittest.main()
