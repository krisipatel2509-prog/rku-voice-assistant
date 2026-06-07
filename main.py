"""RK University — Admission Voice Assistant (FastAPI backend).

Replaces the Node/Express server. Serves the same endpoints the React admin
panel uses, the Twilio voice webhooks, and the built React SPA under /admin.

Run:  uvicorn main:app --host 0.0.0.0 --port 3000
  or: python main.py
"""
import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import RedirectResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import config, bhashini_ready, llm_ready
from app.sarvam_client import sarvam_ready
from app.twilio_voice import router as voice_router, warm_fillers
from app.api_admin import router as admin_router

ROOT = os.path.dirname(os.path.abspath(__file__))
ADMIN_DIST = os.path.join(ROOT, "public", "admin")


def tts_provider():
    if sarvam_ready():
        return f"sarvam ({config.sarvam.tts_model}/{config.sarvam.tts_speaker})"
    if bhashini_ready():
        return "bhashini"
    return "twilio-google (fallback)"


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n  RK University — Admission Voice Assistant (Python/FastAPI)")
    print("  ─────────────────────────────────────────")
    print(f"  Local:     http://localhost:{config.port}")
    print(f"  Admin:     http://localhost:{config.port}/admin")
    print(f"  TTS:       {tts_provider()}")
    print(f"  LLM:       {(config.llm.provider + ' ✓') if llm_ready() else 'mock (KB-driven)'}")
    print(f"  STT path:  {config.stt_engine}")
    if config.public_url:
        print(f"\n  Twilio inbound webhook : {config.public_url}/voice/inbound")
        print(f"  Twilio outbound TwiML  : {config.public_url}/voice/outbound")
    else:
        print("\n  (Set PUBLIC_URL + ngrok to enable phone calls)")
    print("")
    # Pre-synthesise the "thinking" fillers in the background.
    asyncio.create_task(_warm())
    yield


async def _warm():
    await warm_fillers()
    if sarvam_ready():
        print("  Fillers pre-cached ✓\n")


app = FastAPI(lifespan=lifespan)

app.include_router(voice_router)
app.include_router(admin_router)


@app.get("/health")
async def health():
    return {
        "ok": True,
        "tts": tts_provider(),
        "bhashini": "configured" if bhashini_ready() else "mock",
        "llm": config.llm.provider if llm_ready() else "mock",
        "sttEngine": config.stt_engine,
        "publicUrl": config.public_url or "(set PUBLIC_URL for phone calls)",
    }


@app.get("/")
async def root():
    return RedirectResponse("/admin")


# Serve the built React admin SPA (Vite output in public/admin).
if os.path.isdir(os.path.join(ADMIN_DIST, "assets")):
    app.mount("/admin/assets", StaticFiles(directory=os.path.join(ADMIN_DIST, "assets")), name="assets")


@app.get("/admin")
@app.get("/admin/{path:path}")
async def admin_spa(path: str = ""):
    index = os.path.join(ADMIN_DIST, "index.html")
    if os.path.isfile(index):
        return FileResponse(index)
    return JSONResponse(
        {"error": "Admin panel not built — run: cd web && npm install && npm run build"},
        status_code=404,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=config.port)
