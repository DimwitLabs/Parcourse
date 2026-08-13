from functools import lru_cache
from pathlib import Path

_PROMPT_DIR = Path(__file__).resolve().parent.parent / "prompts"


@lru_cache(maxsize=None)
def load(name: str) -> str:
    path = _PROMPT_DIR / f"{name}.txt"
    if not path.is_file():
        raise FileNotFoundError(f"Prompt template not found: {path}")
    return path.read_text(encoding="utf-8")
