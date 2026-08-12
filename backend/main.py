from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import auth, course, guardrail, knowledge_graph, quiz, settings as settings_router, storyboard, transcript, users

app = FastAPI(title="Parcourse API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(transcript.router)
app.include_router(guardrail.router)
app.include_router(course.router)
app.include_router(storyboard.router)
app.include_router(quiz.router)
app.include_router(knowledge_graph.router)
app.include_router(settings_router.router)

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
