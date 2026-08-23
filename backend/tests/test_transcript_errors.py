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

from services.youtube import TranscriptBlocked, _options, extract_video_id, fetch_video

CAPTIONS = {"en": [{"ext": "json3", "url": "https://example.test/track"}]}
EVENTS = {"events": [{"tStartMs": 1360, "dDurationMs": 1680, "segs": [{"utf8": "hello"}]}]}


def extracting(result=None, error=None):
    """yt-dlp is the only thing standing between us and YouTube, so every test
    here replaces it."""
    return patch(
        "services.youtube.YoutubeDL.extract_info", side_effect=error, return_value=result
    )


class ExtractVideoIdTests(unittest.TestCase):
    def test_it_reads_every_shape_the_front_lets_through(self):
        for url in (
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ",
            "https://www.youtube.com/shorts/dQw4w9WgXcQ",
            "https://www.youtube.com/embed/dQw4w9WgXcQ",
            "https://www.youtube.com/live/dQw4w9WgXcQ",
            "https://www.youtube.com/v/dQw4w9WgXcQ",
            "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
            "youtube.com/watch?v=dQw4w9WgXcQ",
        ):
            with self.subTest(url=url):
                self.assertEqual(extract_video_id(url), "dQw4w9WgXcQ")

    def test_something_that_is_not_a_link_is_refused(self):
        with self.assertRaises(ValueError) as caught:
            extract_video_id("https://vimeo.com/12345")
        self.assertIn("YouTube link", str(caught.exception))

    def test_another_host_wearing_a_youtube_path_is_refused(self):
        # The old regex looked only at the path, so any site could carry a
        # watch?v= and be taken for YouTube.
        for url in (
            "https://example.com/watch?v=dQw4w9WgXcQ",
            "https://notyoutube.com/shorts/dQw4w9WgXcQ",
            "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
        ):
            with self.subTest(url=url):
                with self.assertRaises(ValueError):
                    extract_video_id(url)


class FetchVideoTests(unittest.TestCase):
    def test_a_block_is_not_blamed_on_the_video(self):
        with extracting(error=DownloadError("Sign in to confirm you're not a bot")):
            with self.assertRaises(TranscriptBlocked) as caught:
                fetch_video("abc")
        self.assertIn("server", str(caught.exception))

    def test_the_bot_check_is_recognised_with_a_typographic_apostrophe(self):
        """The exact sentence YouTube sent a live deployment. The apostrophe is
        U+2019, and matching only the ASCII one blamed the video for a block."""
        message = (
            "ERROR: [youtube] abc: Sign in to confirm you\u2019re not a bot. "
            "Use --cookies-from-browser or --cookies for the authentication."
        )
        with extracting(error=DownloadError(message)):
            with self.assertRaises(TranscriptBlocked):
                fetch_video("abc")

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
            with patch("services.youtube.YoutubeDL.urlopen", return_value=io.BytesIO(json.dumps(EVENTS).encode())):
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

        def record(url):
            seen["url"] = url
            return io.BytesIO(json.dumps(EVENTS).encode())

        with extracting(result=info):
            with patch("services.youtube.YoutubeDL.urlopen", side_effect=record):
                fetch_video("abc")
        self.assertEqual(seen["url"], "https://example.test/track")


class ProxyTests(unittest.TestCase):
    """A VPS is refused by YouTube on address alone, so the operator points the
    fetch somewhere else and nothing else about the app changes."""

    def test_no_proxy_is_configured_by_default(self):
        self.assertNotIn("proxy", _options())

    def test_a_configured_proxy_reaches_yt_dlp(self):
        with patch("services.youtube.YTDLP_PROXY", "socks5h://user:pw@vpn:1080"):
            self.assertEqual(_options()["proxy"], "socks5h://user:pw@vpn:1080")

    def test_a_broken_proxy_is_not_blamed_on_the_video(self):
        error = DownloadError("ERROR: [youtube] abc: Unable to connect to proxy: Connection refused")
        with patch("services.youtube.YTDLP_PROXY", "socks5h://vpn:1080"):
            with extracting(error=error):
                with self.assertRaises(TranscriptBlocked) as caught:
                    fetch_video("abc")
        self.assertIn("reach YouTube", str(caught.exception))

    def test_captions_are_fetched_through_the_same_opener_as_the_page(self):
        """A caption track pulled outside yt-dlp would leave from the server's
        own address even when a proxy is set, and read as a broken proxy."""
        info = {"title": "t", "subtitles": CAPTIONS}
        with extracting(result=info):
            with patch("services.youtube.YoutubeDL.urlopen", return_value=io.BytesIO(json.dumps(EVENTS).encode())) as opener:
                fetch_video("abc")
        opener.assert_called_once()


class VpnRotationTests(unittest.TestCase):
    """YouTube refuses the address the request left from, so the VPN is asked
    for a different server and the fetch tried again from there."""

    def rotating(self, times, reconnects=True):
        return (
            patch("services.youtube.YTDLP_PROXY", "http://vpn:8888"),
            patch("services.youtube.VPN_ROTATIONS", times),
            patch("services.vpn.VPN_CONTROL_URL", "http://vpn:8000"),
            patch("services.youtube.vpn.rotate", return_value=reconnects),
        )

    def running(self, patches):
        for p in patches:
            started = p.start()
            self.addCleanup(p.stop)
        return started

    def test_a_refusal_reconnects_and_tries_again(self):
        rotate = self.running(self.rotating(2))
        blocked = DownloadError("Sign in to confirm you're not a bot")
        answers = [blocked, blocked, {"title": "t", "subtitles": CAPTIONS}]

        def extract(url, download=False):
            answer = answers.pop(0)
            if isinstance(answer, Exception):
                raise answer
            return answer

        with patch("services.youtube.YoutubeDL.extract_info", side_effect=extract):
            with patch("services.youtube.YoutubeDL.urlopen", side_effect=lambda u: io.BytesIO(json.dumps(EVENTS).encode())):
                video = fetch_video("abc")
        self.assertEqual(video.title, "t")
        self.assertEqual(rotate.call_count, 2)

    def test_the_error_only_arrives_once_the_reconnects_run_out(self):
        rotate = self.running(self.rotating(2))
        with extracting(error=DownloadError("Sign in to confirm you're not a bot")):
            with self.assertRaises(TranscriptBlocked):
                fetch_video("abc")
        self.assertEqual(rotate.call_count, 2)

    def test_a_vpn_that_will_not_move_is_not_asked_twice(self):
        rotate = self.running(self.rotating(3, reconnects=False))
        with extracting(error=DownloadError("Sign in to confirm you're not a bot")):
            with self.assertRaises(TranscriptBlocked):
                fetch_video("abc")
        self.assertEqual(rotate.call_count, 1)

    def test_a_video_problem_is_not_worth_a_reconnect(self):
        """Nothing about a private video changes with the address it is asked
        for, so moving the tunnel would only be slower."""
        rotate = self.running(self.rotating(2))
        with extracting(error=DownloadError("ERROR: Private video")):
            with self.assertRaises(ValueError) as caught:
                fetch_video("abc")
        self.assertNotIsInstance(caught.exception, TranscriptBlocked)
        self.assertEqual(rotate.call_count, 0)

    def test_without_a_vpn_nothing_is_retried(self):
        rotate = self.running((
            patch("services.youtube.YTDLP_PROXY", ""),
            patch("services.youtube.VPN_ROTATIONS", 2),
            patch("services.vpn.VPN_CONTROL_URL", ""),
            patch("services.youtube.vpn.rotate", return_value=True),
        ))
        with extracting(error=DownloadError("Sign in to confirm you're not a bot")):
            with self.assertRaises(TranscriptBlocked):
                fetch_video("abc")
        self.assertEqual(rotate.call_count, 0)

    def test_a_movable_deployment_waits_less_on_each_attempt(self):
        with patch("services.youtube.YTDLP_PROXY", "http://vpn:8888"):
            with patch("services.youtube.VPN_ROTATIONS", 2):
                with patch("services.vpn.VPN_CONTROL_URL", "http://vpn:8000"):
                    self.assertEqual(_options()["socket_timeout"], 8)
                    self.assertEqual(_options()["retries"], 0)
                with patch("services.vpn.VPN_CONTROL_URL", ""):
                    self.assertEqual(_options()["socket_timeout"], 20)
                    self.assertEqual(_options()["retries"], 2)


class FailuresThatMustNotBecomeServerErrors(unittest.TestCase):
    """Every one of these reached the user as a bare HTTP 500 at some point."""

    def test_a_caption_download_that_fails(self):
        info = {"title": "t", "subtitles": CAPTIONS}
        with extracting(result=info):
            with patch("services.youtube.YoutubeDL.urlopen", side_effect=HTTPError("u", 429, "x", {}, None)):
                with self.assertRaises(ValueError):
                    fetch_video("abc")

    def test_captions_that_are_not_json(self):
        info = {"title": "t", "subtitles": CAPTIONS}
        with extracting(result=info):
            with patch("services.youtube.YoutubeDL.urlopen", return_value=io.BytesIO(b"<xml>not json</xml>")):
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
            with patch("services.youtube.YoutubeDL.urlopen", return_value=io.BytesIO(b'{"events": []}')):
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
