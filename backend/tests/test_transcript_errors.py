"""What the user is told when a video cannot become a course. A block on this
server and a video without captions ask for opposite things, so they must not
arrive as the same message.
"""

import io
import json
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

from yt_dlp.utils import DownloadError

from services.youtube import TranscriptBlocked, extract_video_id, fetch_video

CAPTIONS = {"en": [{"ext": "json3", "url": "https://example.test/track"}]}
EVENTS = {"events": [{"tStartMs": 1360, "dDurationMs": 1680, "segs": [{"utf8": "hello"}]}]}


def extracting(result=None, error=None):
    """yt-dlp is the only thing standing between us and YouTube, so every test
    here replaces it."""
    return patch(
        "services.youtube.YoutubeDL.extract_info", side_effect=error, return_value=result
    )


class ExtractVideoIdTests(unittest.TestCase):
    def test_it_reads_the_usual_link_shapes(self):
        for url in (
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ",
            "https://www.youtube.com/shorts/dQw4w9WgXcQ",
        ):
            self.assertEqual(extract_video_id(url), "dQw4w9WgXcQ")

    def test_something_that_is_not_a_link_is_refused(self):
        with self.assertRaises(ValueError) as caught:
            extract_video_id("https://vimeo.com/12345")
        self.assertIn("YouTube link", str(caught.exception))


class FetchVideoTests(unittest.TestCase):
    def test_a_block_is_not_blamed_on_the_video(self):
        with extracting(error=DownloadError("Sign in to confirm you're not a bot")):
            with self.assertRaises(TranscriptBlocked) as caught:
                fetch_video("abc")
        self.assertIn("server", str(caught.exception))

    def test_an_unplayable_video_says_so(self):
        with extracting(error=DownloadError("ERROR: Private video")):
            with self.assertRaises(ValueError) as caught:
                fetch_video("abc")
        self.assertNotIsInstance(caught.exception, TranscriptBlocked)
        self.assertIn("age-restricted", str(caught.exception))

    def test_an_unknown_failure_still_reads_as_one_line(self):
        with extracting(error=DownloadError("something new upstream")):
            with self.assertRaises(ValueError) as caught:
                fetch_video("abc")
        self.assertIn("try another video", str(caught.exception))

    def test_a_video_without_captions_reads_as_a_video_problem(self):
        with extracting(result={"title": "No captions here", "subtitles": {}}):
            with self.assertRaises(ValueError) as caught:
                fetch_video("abc")
        self.assertIn("captions", str(caught.exception))

    def test_captions_become_segments_in_seconds(self):
        with extracting(result={"title": "DNA Explained", "subtitles": CAPTIONS}):
            with patch("urllib.request.urlopen", return_value=io.BytesIO(json.dumps(EVENTS).encode())):
                video = fetch_video("abc")

        self.assertEqual(video.title, "DNA Explained")
        self.assertEqual(video.segments, [{"text": "hello", "start": 1.36, "duration": 1.68}])

    def test_an_author_written_track_beats_the_machine_guess(self):
        info = {
            "title": "t",
            "subtitles": CAPTIONS,
            "automatic_captions": {"en": [{"ext": "json3", "url": "https://example.test/auto"}]},
        }
        seen = {}

        def record(url, timeout=None):
            seen["url"] = url
            return io.BytesIO(json.dumps(EVENTS).encode())

        with extracting(result=info):
            with patch("urllib.request.urlopen", side_effect=record):
                fetch_video("abc")
        self.assertEqual(seen["url"], "https://example.test/track")


class FailuresThatMustNotBecomeServerErrors(unittest.TestCase):
    """Every one of these reached the user as a bare HTTP 500 at some point."""

    def test_a_caption_download_that_fails(self):
        info = {"title": "t", "subtitles": CAPTIONS}
        with extracting(result=info):
            with patch("urllib.request.urlopen", side_effect=HTTPError("u", 429, "x", {}, None)):
                with self.assertRaises(ValueError):
                    fetch_video("abc")

    def test_captions_that_are_not_json(self):
        info = {"title": "t", "subtitles": CAPTIONS}
        with extracting(result=info):
            with patch("urllib.request.urlopen", return_value=io.BytesIO(b"<xml>not json</xml>")):
                with self.assertRaises(ValueError):
                    fetch_video("abc")

    def test_an_extraction_that_returns_nothing(self):
        with extracting(result=None):
            with self.assertRaises(ValueError):
                fetch_video("abc")

    def test_a_track_list_without_json3(self):
        info = {"title": "t", "subtitles": {"en": [{"ext": "vtt", "url": "https://x/t"}]}}
        with extracting(result=info):
            with self.assertRaises(ValueError) as caught:
                fetch_video("abc")
        self.assertIn("captions", str(caught.exception))

    def test_a_caption_url_that_is_not_https(self):
        info = {"title": "t", "subtitles": {"en": [{"ext": "json3", "url": "file:///etc/passwd"}]}}
        with extracting(result=info):
            with self.assertRaises(ValueError):
                fetch_video("abc")

    def test_captions_with_no_readable_text(self):
        info = {"title": "t", "subtitles": CAPTIONS}
        with extracting(result=info):
            with patch("urllib.request.urlopen", return_value=io.BytesIO(b'{"events": []}')):
                with self.assertRaises(ValueError) as caught:
                    fetch_video("abc")
        self.assertIn("empty", str(caught.exception))


class MessagesGoToTheRightPlace(unittest.TestCase):
    """A failure of this server and a failure of one video must not swap."""

    def test_a_youtube_outage_is_not_blamed_on_the_video(self):
        with extracting(error=DownloadError("ERROR: Unable to download webpage: HTTP Error 503")):
            with self.assertRaises(TranscriptBlocked):
                fetch_video("abc")

    def test_a_geo_blocked_video_is_not_blamed_on_the_server(self):
        with extracting(error=DownloadError("ERROR: Video unavailable. X has blocked it in your country")):
            with self.assertRaises(ValueError) as caught:
                fetch_video("abc")
        self.assertNotIsInstance(caught.exception, TranscriptBlocked)

    def test_the_prose_form_of_unavailable_is_recognised(self):
        with extracting(error=DownloadError("ERROR: This video is unavailable")):
            with self.assertRaises(ValueError) as caught:
                fetch_video("abc")
        self.assertIn("age-restricted", str(caught.exception))

    def test_a_missing_po_token_reads_as_a_server_block(self):
        with extracting(error=DownloadError("ERROR: The following content is not available on this app")):
            with self.assertRaises(TranscriptBlocked):
                fetch_video("abc")


if __name__ == "__main__":
    unittest.main()
