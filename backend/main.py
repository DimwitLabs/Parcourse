import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS, LOG_LEVEL
from database import init_db
from routers import auth, course, guardrail, knowledge_graph, note, quiz, settings as settings_router, transcript, users
from version import __version__


logging.basicConfig(
    level=LOG_LEVEL,
    format="%(levelname)s:     %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.getLogger(__name__).info("[cors]: the app may be opened from %s", ", ".join(CORS_ORIGINS) or "nowhere")
    init_db()
    yield


app = FastAPI(title="Parcourse API", version=__version__, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(transcript.router)
app.include_router(guardrail.router)
app.include_router(course.router)
app.include_router(note.router)
app.include_router(quiz.router)
app.include_router(knowledge_graph.router)
app.include_router(settings_router.router)

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
