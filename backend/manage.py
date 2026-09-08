"""Operator commands, run inside the container:

    docker compose exec backend python -m manage reset-password you@example.com
"""

import argparse
import getpass
import sys

from sqlmodel import Session, select

from config import OIDC_NAME, OIDC_ONLY
from database import engine
from models.user import User
from services.auth import hash_password


def reset_password(email: str, password: str | None) -> int:
    """The only way back into an instance whose sole admin forgot the password.
    Nothing else can reach that account: an admin resets other people, and no
    one resets the admin."""
    if OIDC_ONLY:
        print(
            f"This instance signs in through {OIDC_NAME}, so a password here would not work.\n"
            "Set OIDC_ONLY=false and restart if you need the password form back.",
            file=sys.stderr,
        )
        return 1

    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == email)).first()
        if user is None:
            print(f"No user with email {email}", file=sys.stderr)
            return 1

        if password is None:
            password = getpass.getpass("New password: ")
            if password != getpass.getpass("Repeat: "):
                print("Those do not match", file=sys.stderr)
                return 1
        if not password:
            print("Password cannot be empty", file=sys.stderr)
            return 1

        user.hashed_password = hash_password(password)
        user.must_change_password = True
        session.add(user)
        session.commit()

    print(f"Password reset for {email}. They will be asked to change it at next sign in.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="manage", description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    reset = commands.add_parser("reset-password", help="set a user's password")
    reset.add_argument("email")
    reset.add_argument(
        "--password",
        help="skip the prompt. Leaves the password in your shell history, so prefer the prompt.",
    )

    args = parser.parse_args()
    if args.command == "reset-password":
        return reset_password(args.email, args.password)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
