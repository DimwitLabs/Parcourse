"""Turning what the model wrote into the sheet a reader sees. The course
decides the sections; the model only fills them, and a section it renamed or
skipped must not take another section's points with it.
"""

import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from models.cheatsheet_cache import SheetStatus
from schemas.course import CourseResponse
from services.cheatsheet import _points_by_title, claim


def course(*titles):
    return CourseResponse.model_validate({
        "video_id": "abc",
        "thumbnail_url": "",
        "sections": [
            {
                "title": t,
                "summary": "",
                "start_seconds": i * 60.0,
                "end_seconds": (i + 1) * 60.0,
                "mcqs": [],
                "theory_questions": [],
            }
            for i, t in enumerate(titles)
        ],
    })


class PointsByTitleTests(unittest.TestCase):
    def test_points_follow_the_titles_they_were_written_for(self):
        written = {"sections": [
            {"title": "Second", "points": ["b1", "b2"]},
            {"title": "First", "points": ["a1"]},
        ]}
        sections = _points_by_title(written, course("First", "Second"))
        self.assertEqual([s["title"] for s in sections], ["First", "Second"])
        self.assertEqual(sections[0]["points"], ["a1"])
        self.assertEqual(sections[1]["points"], ["b1", "b2"])

    def test_a_title_the_model_reworded_falls_back_to_its_position(self):
        written = {"sections": [{"title": "1. First, revisited", "points": ["a1"]}]}
        sections = _points_by_title(written, course("First"))
        self.assertEqual(sections[0]["points"], ["a1"])

    def test_a_section_the_model_skipped_comes_back_empty(self):
        written = {"sections": [{"title": "First", "points": ["a1"]}]}
        sections = _points_by_title(written, course("First", "Second"))
        self.assertEqual(len(sections), 2)
        self.assertEqual(sections[1]["points"], [])

    def test_the_start_time_comes_from_the_course_not_the_model(self):
        written = {"sections": [{"title": "First", "points": ["a1"], "start_seconds": 999}]}
        self.assertEqual(_points_by_title(written, course("First"))[0]["start_seconds"], 0.0)

    def test_blank_points_are_dropped_and_the_rest_trimmed(self):
        written = {"sections": [{"title": "First", "points": ["  a1  ", "", "   "]}]}
        self.assertEqual(_points_by_title(written, course("First"))[0]["points"], ["a1"])

    def test_nothing_usable_is_still_a_sheet_shaped_answer(self):
        sections = _points_by_title({}, course("First", "Second"))
        self.assertEqual([s["points"] for s in sections], [[], []])

    def test_a_title_that_differs_only_in_case_still_matches(self):
        written = {"sections": [{"title": "HASH TABLES", "points": ["a1"]}]}
        self.assertEqual(_points_by_title(written, course("Hash tables"))[0]["points"], ["a1"])


class FakeSession:
    """Enough of a session for the claim rules, which are about time and status
    rather than about SQL."""

    def __init__(self, row=None):
        self.row = row
        self.committed = 0

    def get(self, _model, _key):
        return self.row

    def add(self, row):
        self.row = row

    def commit(self):
        self.committed += 1


def row(status, age_minutes):
    return SimpleNamespace(
        status=status,
        created_at=datetime.now(timezone.utc) - timedelta(minutes=age_minutes),
        sheet_json="",
    )


class ClaimTests(unittest.TestCase):
    def test_the_first_caller_writes_it(self):
        session = FakeSession()
        self.assertTrue(claim(session, "c1"))
        self.assertIs(session.row.status, SheetStatus.pending)

    def test_a_sheet_already_written_is_not_written_again(self):
        self.assertFalse(claim(FakeSession(row(SheetStatus.ready, 0)), "c1"))

    def test_a_sheet_being_written_is_left_to_finish(self):
        self.assertFalse(claim(FakeSession(row(SheetStatus.pending, 1)), "c1"))

    def test_a_sheet_left_pending_by_a_restart_is_picked_up_again(self):
        session = FakeSession(row(SheetStatus.pending, 30))
        self.assertTrue(claim(session, "c1"))

    def test_a_sheet_that_failed_is_tried_again(self):
        self.assertTrue(claim(FakeSession(row(SheetStatus.failed, 0)), "c1"))

    def test_a_stored_time_without_a_zone_is_read_as_utc(self):
        stale = SimpleNamespace(
            status=SheetStatus.pending,
            created_at=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=30),
            sheet_json="",
        )
        self.assertTrue(claim(FakeSession(stale), "c1"))


if __name__ == "__main__":
    unittest.main()
