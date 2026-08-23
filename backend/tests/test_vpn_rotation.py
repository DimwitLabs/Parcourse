"""Asking the VPN for a different server. A reconnect that silently fails
would send the same refused address back to YouTube, so every way it can go
wrong has to answer no rather than pretend."""

import io
import json
import unittest
import urllib.error
from unittest.mock import patch

from services import vpn


def answering(*replies):
    """Each call to the control server, in order. A string is a status, an
    exception is raised instead."""
    calls = []

    def urlopen(request, timeout=None):
        calls.append((request.get_method(), request.full_url, request.data))
        reply = replies[min(len(calls) - 1, len(replies) - 1)]
        if isinstance(reply, Exception):
            raise reply
        return io.BytesIO(json.dumps({"status": reply}).encode())

    return calls, urlopen


class RotateTests(unittest.TestCase):
    def setUp(self):
        patcher = patch("services.vpn.VPN_CONTROL_URL", "http://vpn:8000")
        patcher.start()
        self.addCleanup(patcher.stop)
        settle = patch("services.vpn.time.sleep")
        settle.start()
        self.addCleanup(settle.stop)

    def test_the_tunnel_is_dropped_and_raised_again(self):
        calls, urlopen = answering("running", "stopped", "stopped", "running", "running")
        with patch("services.vpn.urllib.request.urlopen", side_effect=urlopen):
            self.assertTrue(vpn.rotate())

        methods = [method for method, _, _ in calls]
        self.assertEqual(methods[:1], ["GET"])
        self.assertIn("PUT", methods)
        bodies = [json.loads(data) for _, _, data in calls if data]
        self.assertEqual(bodies, [{"status": "stopped"}, {"status": "running"}])

    def test_an_unreachable_control_server_is_not_a_reconnect(self):
        _, urlopen = answering(OSError("connection refused"))
        with patch("services.vpn.urllib.request.urlopen", side_effect=urlopen):
            self.assertFalse(vpn.rotate())

    def test_a_tunnel_that_never_comes_back_is_not_a_reconnect(self):
        calls, urlopen = answering("running", "stopped", "stopped")
        with patch("services.vpn.urllib.request.urlopen", side_effect=urlopen):
            with patch("services.vpn._SETTLE_SECONDS", 0.01):
                self.assertFalse(vpn.rotate())

    def test_the_older_endpoint_is_used_when_the_new_one_is_absent(self):
        seen = []

        def urlopen(request, timeout=None):
            seen.append(request.full_url)
            if request.full_url.endswith("/v1/vpn/status"):
                raise urllib.error.HTTPError(request.full_url, 404, "no", {}, None)
            status = "stopped" if len([u for u in seen if "openvpn" in u]) > 1 else "running"
            return io.BytesIO(json.dumps({"status": status}).encode())

        with patch("services.vpn.urllib.request.urlopen", side_effect=urlopen):
            with patch("services.vpn._SETTLE_SECONDS", 0.01):
                vpn.rotate()
        self.assertTrue(any(u.endswith("/v1/openvpn/status") for u in seen))

    def test_nothing_is_asked_when_no_control_server_is_configured(self):
        with patch("services.vpn.VPN_CONTROL_URL", ""):
            with patch("services.vpn.urllib.request.urlopen") as urlopen:
                self.assertFalse(vpn.rotate())
        urlopen.assert_not_called()


if __name__ == "__main__":
    unittest.main()
