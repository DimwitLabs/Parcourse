"""The OpenID Connect authorization code flow, with PKCE.

Only the specification is implemented here, never a particular provider: the
issuer's discovery document names every endpoint and key, which is what lets
the same code work against Zitadel, Keycloak, Auth0, Entra or Google.
"""

import logging
import secrets
import time
from urllib.parse import urlencode

import httpx
from authlib.oauth2.rfc7636 import create_s256_code_challenge
from authlib.oidc.core import CodeIDToken
from joserfc import jwt
from joserfc.errors import JoseError
from joserfc.jwk import KeySet

from config import (
    OIDC_CLIENT_ID,
    OIDC_CLIENT_SECRET,
    OIDC_ISSUER,
    OIDC_REDIRECT_URL,
    OIDC_SCOPES,
)

logger = logging.getLogger(__name__)

_TIMEOUT = 10
_SIGNING_ALGORITHMS = frozenset(
    {"RS256", "RS384", "RS512", "ES256", "ES384", "ES512", "PS256", "PS384", "PS512"}
)

_CACHE_FOR = 3600

_discovery: dict | None = None
_discovery_read_at = 0.0
_jwks: dict | None = None
_jwks_read_at = 0.0


class OidcError(Exception):
    """Anything that stops a sign-in, phrased for the person who has to fix it."""


def discovery() -> dict:
    """The issuer's own description of itself, kept for _CACHE_FOR seconds."""
    global _discovery, _discovery_read_at
    if _discovery is not None and time.monotonic() - _discovery_read_at < _CACHE_FOR:
        return _discovery

    url = f"{OIDC_ISSUER}/.well-known/openid-configuration"
    try:
        response = httpx.get(url, timeout=_TIMEOUT)
        response.raise_for_status()
        document = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise OidcError(f"Could not read {url}: {exc}") from exc

    named = str(document.get("issuer", "")).rstrip("/")
    if named != OIDC_ISSUER:
        raise OidcError(f"{url} describes issuer {named or 'nothing'}, not {OIDC_ISSUER}")

    for field in ("authorization_endpoint", "token_endpoint", "jwks_uri"):
        if not document.get(field):
            raise OidcError(f"{url} does not name {field}")

    _discovery = document
    _discovery_read_at = time.monotonic()
    logger.info("[oidc]: discovered %s", OIDC_ISSUER)
    return document


def _keys(refresh: bool = False) -> dict:
    """The provider's public keys. A signature naming a key we have not seen
    means they rotated, so the set is fetched again before giving up."""
    global _jwks, _jwks_read_at
    stale = time.monotonic() - _jwks_read_at >= _CACHE_FOR
    if _jwks is None or refresh or stale:
        url = discovery()["jwks_uri"]
        try:
            response = httpx.get(url, timeout=_TIMEOUT)
            response.raise_for_status()
            _jwks = response.json()
            _jwks_read_at = time.monotonic()
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("[oidc]: cannot read the signing keys at %s: %s", url, exc)
            raise OidcError("Your provider could not be reached. Please try again.") from exc
    return _jwks


def _algorithms() -> list[str]:
    advertised = discovery().get("id_token_signing_alg_values_supported") or ["RS256"]
    allowed = [name for name in advertised if name in _SIGNING_ALGORITHMS]
    if not allowed:
        raise OidcError(f"{OIDC_ISSUER} signs id tokens only with algorithms Parcourse will not accept")
    return allowed


def start(state: str, nonce: str) -> tuple[str, str]:
    """Where to send the browser, and the PKCE secret to keep until it returns.

    The verifier never leaves this server; only its hash is sent. A code stolen
    in transit is then useless, because whoever took it cannot produce the
    verifier the provider will ask for."""
    verifier = secrets.token_urlsafe(64)
    challenge = create_s256_code_challenge(verifier)

    query = urlencode({
        "response_type": "code",
        "client_id": OIDC_CLIENT_ID,
        "redirect_uri": OIDC_REDIRECT_URL,
        "scope": OIDC_SCOPES,
        "state": state,
        "nonce": nonce,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    })
    return f"{discovery()['authorization_endpoint']}?{query}", verifier


def _token_request(code: str, verifier: str) -> dict:
    document = discovery()
    form = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": OIDC_REDIRECT_URL,
        "code_verifier": verifier,
        "client_id": OIDC_CLIENT_ID,
    }
    methods = document.get("token_endpoint_auth_methods_supported") or ["client_secret_basic"]

    if "client_secret_post" in methods:
        form["client_secret"] = OIDC_CLIENT_SECRET
        auth = None
    else:
        auth = (OIDC_CLIENT_ID, OIDC_CLIENT_SECRET)

    try:
        response = httpx.post(document["token_endpoint"], data=form, auth=auth, timeout=_TIMEOUT)
    except httpx.HTTPError as exc:
        logger.warning("[oidc]: token endpoint unreachable: %s", exc)
        raise OidcError("Your provider could not be reached. Please try again.") from exc

    if response.status_code != 200:
        logger.warning("[oidc]: token endpoint said %s: %s", response.status_code, response.text[:200])
        raise OidcError("The provider refused this sign-in. Please try again.")
    return response.json()


def claims(code: str, verifier: str, nonce: str) -> dict:
    """Trades the code for an id token and checks it, or raises.

    joserfc checks the signature; authlib's CodeIDToken checks what the claims
    have to say for an id token specifically, which is where the issuer, the
    audience and the nonce are held to account."""
    payload = _token_request(code, verifier)
    id_token = payload.get("id_token")
    if not id_token:
        raise OidcError("The provider returned no id token")

    for refresh in (False, True):
        try:
            token = jwt.decode(
                id_token,
                KeySet.import_key_set(_keys(refresh=refresh)),
                algorithms=_algorithms(),
            )
            break
        except (JoseError, ValueError, KeyError) as exc:
            if refresh:
                logger.warning("[oidc]: id token signature refused: %s", exc)
                raise OidcError("This sign-in could not be verified. Please try again.") from exc

    # The token's issuer has to equal the discovery document's own `issuer`
    # exactly, punctuation and all. Auth0 writes it with a trailing slash, so
    # comparing against the tidied-up setting would turn every sign-in away.
    verified = CodeIDToken(
        token.claims,
        token.header,
        options={
            "iss": {"essential": True, "value": discovery()["issuer"]},
            "aud": {"essential": True, "value": OIDC_CLIENT_ID},
            "sub": {"essential": True},
        },
        params={"nonce": nonce, "client_id": OIDC_CLIENT_ID},
    )
    try:
        verified.validate()
    except JoseError as exc:
        logger.warning("[oidc]: id token refused: %s", exc)
        raise OidcError("This sign-in could not be verified. Please try again.") from exc

    return dict(verified)
