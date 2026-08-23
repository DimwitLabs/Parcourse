import json
import logging
import time
import urllib.error
import urllib.request

from config import VPN_CONTROL_URL

logger = logging.getLogger(__name__)

_ENDPOINTS = ("/v1/vpn/status", "/v1/openvpn/status")
_SETTLE_SECONDS = 45
_POLL_SECONDS = 2
_REQUEST_TIMEOUT = 10


def available() -> bool:
    return bool(VPN_CONTROL_URL)


def _call(method: str, path: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(
        f"{VPN_CONTROL_URL}{path}",
        data=data,
        method=method,
        headers={"Content-Type": "application/json"} if data else {},
    )
    with urllib.request.urlopen(request, timeout=_REQUEST_TIMEOUT) as response:
        return json.loads(response.read() or b"{}")


def _endpoint() -> str | None:
    """Gluetun renamed the tunnel endpoint and kept the old name working, so
    whichever this build answers on is the one used from here on."""
    for path in _ENDPOINTS:
        try:
            _call("GET", path)
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                continue
            return path
        except OSError:
            return None
        else:
            return path
    return None


def _wait_for(path: str, wanted: str) -> bool:
    deadline = time.monotonic() + _SETTLE_SECONDS
    while time.monotonic() < deadline:
        try:
            if _call("GET", path).get("status") == wanted:
                return True
        except OSError:
            pass
        time.sleep(_POLL_SECONDS)
    return False


def rotate() -> bool:
    """Drops the tunnel and raises it again, which lands on a different server
    from the pool the provider settings allow. The address the request leaves
    from is the whole reason YouTube refused it, so nothing else about the
    retry needs to change."""
    if not available():
        return False

    path = _endpoint()
    if not path:
        logger.error("[vpn]: no control server answered at %s", VPN_CONTROL_URL)
        return False

    try:
        _call("PUT", path, {"status": "stopped"})
        if not _wait_for(path, "stopped"):
            logger.error("[vpn]: the tunnel did not come down within %ds", _SETTLE_SECONDS)
            return False
        _call("PUT", path, {"status": "running"})
    except OSError as exc:
        logger.error("[vpn]: could not reach the control server: %s", exc)
        return False

    if not _wait_for(path, "running"):
        logger.error("[vpn]: the tunnel did not come back within %ds", _SETTLE_SECONDS)
        return False

    logger.info("[vpn]: reconnected through a different server")
    return True
