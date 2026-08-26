"""The notepad's two endpoints. Who a sheet belongs to is the whole security
boundary, since a note is keyed by course alone; the rest is what a reader gets
back before they have written anything, and that a second save edits the sheet
rather than starting another one.
"""

import unittest
import uuid
from types import SimpleNamespace

from fastapi import HTTPException
from pydantic import ValidationError

from models.note import CourseNote
from routers.note import _owned_course, read_note, write_note
from schemas.note import LONGEST_SHEET_WORTH_KEEPING, NoteSaveRequest


class Session:
    """Only what the two endpoints reach: courses to prove ownership against,
    and notes that persist across calls the way a table would."""

    def __init__(self, courses, notes=None):
        self.courses = courses
        self.notes = notes or {}

    def get(self, model, key):
        store = self.notes if model is CourseNote else self.courses
        return store.get(key)

    def add(self, note):
        self.notes[note.course_id] = note

    def commit(self):
        pass

    def refresh(self, note):
        pass


def user():
    return SimpleNamespace(id=uuid.uuid4())


def course_of(reader):
    course_id = uuid.uuid4()
    return course_id, Session({course_id: SimpleNamespace(user_id=reader.id)})


class OwnedCourseTests(unittest.TestCase):
    def test_a_course_of_your_own_comes_back(self):
        reader = user()
        course_id, session = course_of(reader)

        self.assertEqual(_owned_course(str(course_id), reader, session), course_id)

    def test_someone_elses_course_is_not_found(self):
        course_id = uuid.uuid4()
        session = Session({course_id: SimpleNamespace(user_id=uuid.uuid4())})

        with self.assertRaises(HTTPException) as caught:
            _owned_course(str(course_id), user(), session)
        self.assertEqual(caught.exception.status_code, 404)

    def test_a_course_that_is_not_there_is_not_found(self):
        with self.assertRaises(HTTPException) as caught:
            _owned_course(str(uuid.uuid4()), user(), Session({}))
        self.assertEqual(caught.exception.status_code, 404)

    def test_something_that_is_not_an_id_is_refused_before_any_lookup(self):
        with self.assertRaises(HTTPException) as caught:
            _owned_course("../../etc/passwd", user(), Session({}))
        self.assertEqual(caught.exception.status_code, 400)


class ReadNoteTests(unittest.TestCase):
    def test_a_course_never_written_on_reads_as_a_blank_sheet(self):
        reader = user()
        course_id, session = course_of(reader)

        answer = read_note(str(course_id), reader, session)

        self.assertEqual(answer.body, "")
        self.assertIsNone(answer.updated_at)

    def test_a_written_sheet_reads_back_with_its_stamp(self):
        reader = user()
        course_id, session = course_of(reader)
        written = CourseNote(course_id=course_id, body="kept")
        session.add(written)

        answer = read_note(str(course_id), reader, session)

        self.assertEqual(answer.body, "kept")
        self.assertEqual(answer.updated_at, written.updated_at)

    def test_someone_elses_notes_are_not_readable(self):
        course_id = uuid.uuid4()
        session = Session({course_id: SimpleNamespace(user_id=uuid.uuid4())})
        session.add(CourseNote(course_id=course_id, body="private"))

        with self.assertRaises(HTTPException) as caught:
            read_note(str(course_id), user(), session)
        self.assertEqual(caught.exception.status_code, 404)


class WriteNoteTests(unittest.TestCase):
    def test_the_first_save_starts_the_sheet(self):
        reader = user()
        course_id, session = course_of(reader)

        answer = write_note(str(course_id), NoteSaveRequest(body="first"), reader, session)

        self.assertEqual(answer.body, "first")
        self.assertEqual(list(session.notes), [course_id])

    def test_a_second_save_edits_the_same_sheet(self):
        reader = user()
        course_id, session = course_of(reader)
        write_note(str(course_id), NoteSaveRequest(body="first"), reader, session)
        started = session.notes[course_id].updated_at

        answer = write_note(str(course_id), NoteSaveRequest(body="second"), reader, session)

        self.assertEqual(answer.body, "second")
        self.assertEqual(list(session.notes), [course_id])
        self.assertGreaterEqual(session.notes[course_id].updated_at, started)

    def test_someone_elses_notes_cannot_be_written_over(self):
        course_id = uuid.uuid4()
        session = Session({course_id: SimpleNamespace(user_id=uuid.uuid4())})
        session.add(CourseNote(course_id=course_id, body="private"))

        with self.assertRaises(HTTPException) as caught:
            write_note(str(course_id), NoteSaveRequest(body="theirs now"), user(), session)
        self.assertEqual(caught.exception.status_code, 404)
        self.assertEqual(session.notes[course_id].body, "private")


class SheetLengthTests(unittest.TestCase):
    def test_a_sheet_at_the_limit_is_accepted(self):
        request = NoteSaveRequest(body="x" * LONGEST_SHEET_WORTH_KEEPING)
        self.assertEqual(len(request.body), LONGEST_SHEET_WORTH_KEEPING)

    def test_a_longer_sheet_is_refused(self):
        with self.assertRaises(ValidationError):
            NoteSaveRequest(body="x" * (LONGEST_SHEET_WORTH_KEEPING + 1))


if __name__ == "__main__":
    unittest.main()
