import unittest
from unittest.mock import patch

from youtube_transcript_api import IpBlocked, TranscriptsDisabled, VideoUnavailable

from services.youtube import TranscriptBlocked, fetch_transcript


class FetchTranscriptErrors(unittest.TestCase):
    """A block on the server's address and a video without captions ask the user
    for opposite things, so they must not arrive as the same message."""

    def _raises(self, error):
        return patch(
            "services.youtube.YouTubeTranscriptApi.fetch",
            side_effect=error,
        )

    def test_ip_block_is_not_blamed_on_the_video(self):
        with self._raises(IpBlocked("abc")):
            with self.assertRaises(TranscriptBlocked) as caught:
                fetch_transcript("abc")
        self.assertIn("server", str(caught.exception))

    def test_missing_captions_reads_as_a_video_problem(self):
        with self._raises(TranscriptsDisabled("abc")):
            with self.assertRaises(ValueError) as caught:
                fetch_transcript("abc")
        self.assertNotIsInstance(caught.exception, TranscriptBlocked)
        self.assertIn("captions", str(caught.exception))

    def test_unavailable_video_says_so(self):
        with self._raises(VideoUnavailable("abc")):
            with self.assertRaises(ValueError) as caught:
                fetch_transcript("abc")
        self.assertIn("age-restricted", str(caught.exception))

    def test_unknown_failures_still_surface_as_value_errors(self):
        with self._raises(RuntimeError("something new")):
            with self.assertRaises(ValueError):
                fetch_transcript("abc")


if __name__ == "__main__":
    unittest.main()
