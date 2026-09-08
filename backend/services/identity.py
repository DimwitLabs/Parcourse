"""Turning a verified id token into the local account it belongs to."""

import logging

from sqlmodel import Session, select

from config import OIDC_AUTO_PROVISION
from models.instance_config import INSTANCE_ID, InstanceConfig, InstanceMode
from models.user import User, UserRole
from models.user_identity import UserIdentity
from services.oidc import OidcError

logger = logging.getLogger(__name__)


def _linked(session: Session, issuer: str, subject: str) -> User | None:
    identity = session.exec(
        select(UserIdentity).where(UserIdentity.issuer == issuer, UserIdentity.subject == subject)
    ).first()
    if identity is None:
        return None

    user = session.get(User, identity.user_id)
    if user is None:
        # The account was deleted and the link outlived it, which the cascade
        # should prevent. Treating it as unlinked is better than a 500.
        logger.warning("[oidc]: identity %s points at a user that is gone", identity.id)
        session.delete(identity)
        return None
    return user


def _link(session: Session, user: User, issuer: str, subject: str) -> None:
    session.add(UserIdentity(user_id=user.id, issuer=issuer, subject=subject))

    if user.must_change_password:
        logger.info("[oidc]: dropping the placeholder password on %s", user.email)
        user.hashed_password = None
        user.must_change_password = False
        session.add(user)

    logger.info("[oidc]: linked %s to subject %s at %s", user.email, subject, issuer)


def resolve(session: Session, claims: dict) -> User:
    """The user this token signs in, linking or creating one if policy allows."""
    issuer = str(claims["iss"]).rstrip("/")
    subject = str(claims["sub"])

    user = _linked(session, issuer, subject)
    if user is not None:
        return user

    email = (claims.get("email") or "").strip().lower()
    if not email:
        raise OidcError("The provider sent no email address, so there is nothing to match an account on")

    existing = session.exec(select(User).where(User.email == email)).first()
    if existing is not None:
        if claims.get("email_verified") is not True:
            raise OidcError(f"An account already uses {email}, and the provider did not verify that address")
        _link(session, existing, issuer, subject)
        return existing

    if not OIDC_AUTO_PROVISION:
        raise OidcError(f"No account here uses {email}. An admin has to create it first")

    config = session.get(InstanceConfig, INSTANCE_ID)
    if config is not None and config.mode == InstanceMode.single:
        raise OidcError("This is a single-user instance, so it will not make a second account")

    user = User(
        email=email,
        hashed_password=None,
        role=UserRole.student,
        first_name=claims.get("given_name"),
        last_name=claims.get("family_name"),
    )
    session.add(user)
    session.flush()
    _link(session, user, issuer, subject)
    logger.info("[oidc]: created an account for %s", email)
    return user
