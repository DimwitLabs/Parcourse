"""The transcript belongs to the video, so the second person to ask for one
should not send this server back to YouTube for the same answer.
"""

import json
import unittest
from unittest.mock import patch

from sqlmodel import Session, SQLModel, create_engine

from config import SCHEMA
from models.cached_transcript import CachedTranscript
from services.transcript import load_video
from services.youtube import Video

VIDEO = Video(title="Ropes", segments=[{"text": "hello", "start": 1.0, "duration": 2.0}])


class LoadTests(unittest.TestCase):
    def setUp(self):
        # The models name their schema, which sqlite has no concept of.
        self.engine = create_engine("sqlite://").execution_options(
            schema_translate_map={SCHEMA: None}
        )
        SQLModel.metadata.create_all(self.engine, tables=[CachedTranscript.__table__])

    def test_the_first_ask_fetches_and_stores(self):
        with Session(self.engine) as session:
            with patch("services.transcript.fetch_video", return_value=VIDEO) as fetch:
                video = load_video(session, "abc")
            self.assertEqual(fetch.call_count, 1)
            self.assertEqual(video.title, "Ropes")
            stored = session.get(CachedTranscript, "abc")
            self.assertEqual(json.loads(stored.segments_json), VIDEO.segments)

    def test_the_second_ask_does_not_reach_youtube(self):
        with Session(self.engine) as session:
            with patch("services.transcript.fetch_video", return_value=VIDEO):
                load_video(session, "abc")
            with patch("services.transcript.fetch_video") as fetch:
                video = load_video(session, "abc")
            fetch.assert_not_called()
            self.assertEqual(video.title, "Ropes")
            self.assertEqual(video.segments, VIDEO.segments)

    def test_a_different_video_is_fetched_on_its_own(self):
        with Session(self.engine) as session:
            with patch("services.transcript.fetch_video", return_value=VIDEO):
                load_video(session, "abc")
            other = Video(title="Other", segments=[{"text": "hi", "start": 0.0, "duration": 1.0}])
            with patch("services.transcript.fetch_video", return_value=other) as fetch:
                video = load_video(session, "xyz")
            self.assertEqual(fetch.call_count, 1)
            self.assertEqual(video.title, "Other")

    def test_a_failed_fetch_stores_nothing(self):
        with Session(self.engine) as session:
            with patch("services.transcript.fetch_video", side_effect=ValueError("no captions")):
                with self.assertRaises(ValueError):
                    load_video(session, "abc")
            self.assertIsNone(session.get(CachedTranscript, "abc"))

    def test_a_video_without_a_title_is_not_stored(self):
        """A blank title would otherwise be permanent."""
        with Session(self.engine) as session:
            untitled = Video(title="", segments=VIDEO.segments)
            with patch("services.transcript.fetch_video", return_value=untitled):
                video = load_video(session, "abc")
            self.assertEqual(video.segments, VIDEO.segments)
            self.assertIsNone(session.get(CachedTranscript, "abc"))


if __name__ == "__main__":
    unittest.main()
