import os
from typing import List

from dotenv import load_dotenv
load_dotenv()

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import engine, chat

app = FastAPI(title="RootSight AI — Root-Cause Intelligence API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "tickets.csv")


@app.get("/api/health")
def health():
    """Quick backend + configured model-provider connectivity check."""
    model_connected = False
    try:
        headers = {"Authorization": f"Bearer {engine.MODEL_API_KEY}"}
        r = httpx.get(f"{engine.MODEL_BASE_URL}/models", headers=headers, timeout=3.0)
        model_connected = r.status_code == 200
    except Exception:
        model_connected = False
    return {
        "status": "ok",
        "model_connected": model_connected,
        "provider": engine.MODEL_PROVIDER,
        "model": engine.MODEL,
    }


@app.get("/api/analysis")
def get_analysis(refresh: bool = False):
    """Run (or return cached) cluster + AI root-cause analysis."""
    try:
        result = engine.run_full_analysis(DATA_PATH, force=refresh)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Analysis failed - check the configured model provider ({e})",
        )


@app.get("/api/tickets/{cluster_id}")
def get_cluster_tickets(cluster_id: int):
    cached = engine._cache["clusters"]
    if cached is None:
        raise HTTPException(status_code=400, detail="Run /api/analysis first")
    match = [c for c in cached["clusters"] if c["cluster_id"] == cluster_id]
    if not match:
        raise HTTPException(status_code=404, detail="Cluster not found")
    return match[0]


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    history: List[ChatTurn] = []
    message: str


@app.post("/api/chat")
def post_chat(req: ChatRequest):
    try:
        history = [t.model_dump() for t in req.history]
        result = chat.chat_reply(history, req.message)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Chat model unreachable - check the configured model provider ({e})",
        )
