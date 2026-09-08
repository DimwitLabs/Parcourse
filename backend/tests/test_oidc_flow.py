"""What the OIDC client accepts and what it refuses.

The protocol pieces are exercised against a stubbed provider rather than a live
one: what matters is that a document naming the wrong issuer, a token signed
with the wrong key, and a token belonging to another sign-in are each turned
away, because every one of those is somebody signing in as someone else.
"""

import base64
import hashlib
import json
import os
import time
import unittest
from unittest import mock

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ENCRYPTION_KEY", "Ml4v57Co5JT1bqiqQ5ybWBg5Iq1eRVCDhKTxF4ITsIE=")

from joserfc import jwt  # noqa: E402
from joserfc.jwk import RSAKey  # noqa: E402
from cryptography.hazmat.primitives import serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import rsa  # noqa: E402

from services import oidc  # noqa: E402

ISSUER = "https://issuer.test"
CLIENT_ID = "parcourse"


def a_key(kid: str) -> tuple[str, dict]:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    public = key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    jwk = RSAKey.import_key(public, {"use": "sig", "alg": "RS256", "kid": kid}).as_dict()
    return pem, jwk


SIGNING_PEM, SIGNING_JWK = a_key("real")
OTHER_PEM, _ = a_key("forged")

DISCOVERY = {
    "issuer": ISSUER,
    "authorization_endpoint": f"{ISSUER}/authorize",
    "token_endpoint": f"{ISSUER}/token",
    "jwks_uri": f"{ISSUER}/jwks",
    "id_token_signing_alg_values_supported": ["RS256"],
    "token_endpoint_auth_methods_supported": ["client_secret_post"],
}


def an_id_token(pem: str = SIGNING_PEM, **overrides) -> str:
    now = int(time.time())
    claims = {
        "iss": ISSUER,
        "sub": "subject-1",
        "aud": CLIENT_ID,
        "iat": now,
        "exp": now + 300,
        "nonce": "the-nonce",
        "email": "someone@example.com",
        "email_verified": True,
    }
    claims.update(overrides)
    return jwt.encode({"alg": "RS256", "kid": "real"}, claims, RSAKey.import_key(pem))


class Answer:
    """The shape httpx.get and httpx.post return, as far as this code reads."""

    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code
        self.text = json.dumps(payload)

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class OidcTestCase(unittest.TestCase):
    def setUp(self):
        self._forget_caches()
        patches = [
            mock.patch.object(oidc, "OIDC_ISSUER", ISSUER),
            mock.patch.object(oidc, "OIDC_CLIENT_ID", CLIENT_ID),
            mock.patch.object(oidc, "OIDC_CLIENT_SECRET", "shh"),
            mock.patch.object(oidc, "OIDC_REDIRECT_URL", "https://app.test/auth/oidc/callback"),
            mock.patch.object(oidc, "OIDC_SCOPES", "openid email profile"),
        ]
        for patch in patches:
            patch.start()
            self.addCleanup(patch.stop)

    def tearDown(self):
        self._forget_caches()

    @staticmethod
    def _forget_caches():
        oidc._discovery = None
        oidc._discovery_read_at = 0.0
        oidc._jwks = None
        oidc._jwks_read_at = 0.0


class Discovery(OidcTestCase):
    def test_a_document_naming_another_issuer_is_refused(self):
        """The document says who it speaks for, and it has to be the issuer we
        asked. Otherwise a redirected fetch could hand over someone else's
        endpoints."""
        impostor = dict(DISCOVERY, issuer="https://somewhere.else")
        with mock.patch.object(oidc.httpx, "get", return_value=Answer(impostor)):
            with self.assertRaises(oidc.OidcError) as caught:
                oidc.discovery()
        self.assertIn("somewhere.else", str(caught.exception))

    def test_a_document_missing_an_endpoint_is_refused(self):
        without = {k: v for k, v in DISCOVERY.items() if k != "token_endpoint"}
        with mock.patch.object(oidc.httpx, "get", return_value=Answer(without)):
            with self.assertRaises(oidc.OidcError) as caught:
                oidc.discovery()
        self.assertIn("token_endpoint", str(caught.exception))

    def test_it_is_fetched_once(self):
        with mock.patch.object(oidc.httpx, "get", return_value=Answer(DISCOVERY)) as fetch:
            oidc.discovery()
            oidc.discovery()
        self.assertEqual(fetch.call_count, 1)


class Algorithms(OidcTestCase):
    def test_symmetric_signing_is_not_accepted(self):
        """HS256 is signed with a secret both sides know, so anyone holding the
        client secret could mint an id token for any user."""
        symmetric = dict(DISCOVERY, id_token_signing_alg_values_supported=["HS256", "none"])
        with mock.patch.object(oidc.httpx, "get", return_value=Answer(symmetric)):
            with self.assertRaises(oidc.OidcError):
                oidc._algorithms()

    def test_the_asymmetric_ones_survive(self):
        mixed = dict(DISCOVERY, id_token_signing_alg_values_supported=["HS256", "RS256", "ES256"])
        with mock.patch.object(oidc.httpx, "get", return_value=Answer(mixed)):
            self.assertEqual(oidc._algorithms(), ["RS256", "ES256"])


class Start(OidcTestCase):
    def test_the_challenge_is_the_hash_of_the_verifier(self):
        """PKCE only works if the challenge sent to the provider really is the
        S256 hash of the verifier kept back."""
        with mock.patch.object(oidc.httpx, "get", return_value=Answer(DISCOVERY)):
            destination, verifier = oidc.start("the-state", "the-nonce")

        expected = base64.urlsafe_b64encode(
            hashlib.sha256(verifier.encode()).digest()
        ).rstrip(b"=").decode()
        self.assertIn(f"code_challenge={expected}", destination)
        self.assertIn("code_challenge_method=S256", destination)
        self.assertIn("state=the-state", destination)
        self.assertIn("nonce=the-nonce", destination)
        self.assertTrue(destination.startswith(f"{ISSUER}/authorize?"))

    def test_the_verifier_is_never_in_the_url(self):
        with mock.patch.object(oidc.httpx, "get", return_value=Answer(DISCOVERY)):
            destination, verifier = oidc.start("s", "n")
        self.assertNotIn(verifier, destination)


class Claims(OidcTestCase):
    def _exchange(self, id_token, nonce="the-nonce"):
        with mock.patch.object(oidc.httpx, "get", side_effect=self._fetch), mock.patch.object(
            oidc.httpx, "post", return_value=Answer({"id_token": id_token})
        ):
            return oidc.claims("the-code", "the-verifier", nonce)

    @staticmethod
    def _fetch(url, **_):
        if url.endswith("/jwks"):
            return Answer({"keys": [SIGNING_JWK]})
        return Answer(DISCOVERY)

    def test_a_good_token_comes_back(self):
        verified = self._exchange(an_id_token())
        self.assertEqual(verified["sub"], "subject-1")
        self.assertEqual(verified["email"], "someone@example.com")

    def test_another_key_is_refused(self):
        """Signed by someone who is not the provider."""
        with self.assertRaises(oidc.OidcError):
            self._exchange(an_id_token(pem=OTHER_PEM))

    def test_another_sign_in_s_nonce_is_refused(self):
        """An id token captured from one attempt replayed into another."""
        with self.assertRaises(oidc.OidcError) as caught:
            self._exchange(an_id_token(nonce="somebody-elses"))
        # The reason names the claim for the log and not for the screen.
        self.assertIn("nonce", str(caught.exception.__cause__))
        self.assertNotIn("nonce", str(caught.exception))

    def test_another_audience_is_refused(self):
        """Issued for a different client at the same provider."""
        with self.assertRaises(oidc.OidcError):
            self._exchange(an_id_token(aud="some-other-app"))

    def test_an_expired_token_is_refused(self):
        past = int(time.time()) - 3600
        with self.assertRaises(oidc.OidcError):
            self._exchange(an_id_token(exp=past, iat=past - 300))

    def test_a_token_with_no_subject_is_refused(self):
        with self.assertRaises(oidc.OidcError) as caught:
            self._exchange(an_id_token(sub=""))
        self.assertIn("sub", str(caught.exception.__cause__))

    def test_a_refusal_from_the_provider_is_logged_not_shown(self):
        """The body can carry our own client credentials back at us, so it
        belongs in the operator's log and nowhere near the browser."""
        with mock.patch.object(oidc.httpx, "get", side_effect=self._fetch), mock.patch.object(
            oidc.httpx, "post", return_value=Answer({"error": "invalid_grant"}, status_code=400)
        ):
            with self.assertLogs("services.oidc", level="WARNING") as logged:
                with self.assertRaises(oidc.OidcError) as caught:
                    oidc.claims("used-already", "v", "the-nonce")
        self.assertNotIn("invalid_grant", str(caught.exception))
        self.assertIn("invalid_grant", "\n".join(logged.output))

    def test_no_id_token_is_refused(self):
        with mock.patch.object(oidc.httpx, "get", side_effect=self._fetch), mock.patch.object(
            oidc.httpx, "post", return_value=Answer({"access_token": "only-this"})
        ):
            with self.assertRaises(oidc.OidcError):
                oidc.claims("c", "v", "the-nonce")


if __name__ == "__main__":
    unittest.main()
