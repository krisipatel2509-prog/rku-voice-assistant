# RK University — Gujarati Admission Voice Assistant 🎓📞

A human-like AI admission counselor that handles **inbound and outbound calls in
Gujarati** — answering course queries from RK University's catalogue, capturing
lead details naturally (one question at a time), and saving them for follow-up.

**Stack:** Python · [FastAPI](https://fastapi.tiangolo.com) · Twilio (telephony) ·
[Sarvam AI](https://sarvam.ai) Bulbul TTS + Saarika STT (Gujarati) ·
OpenAI (knowledge assistant) · React admin panel (Vite).

---

## How a call flows

```
Caller ─▶ Twilio ─▶ FastAPI (/voice/*)
                       │
        ┌──────────────┼───────────────────────────┐
        ▼              ▼                             ▼
   <Record> audio   Sarvam STT (Saarika)      Sarvam TTS (Bulbul)
   from caller   ─▶ Gujarati transcript  ─▶   8 kHz reply  ─▶ <Play>
                       │
                       ▼
        Admission assistant (OpenAI / offline KB)  ─▶  leads.json
```

To keep latency low, each turn returns a short "thinking" filler immediately
while transcription + LLM + TTS run **concurrently** in the background, then the
rendered reply is played.

## Conversation flow

`Name → Course → (eligibility stated) → Qualification → "want to know more?" + Q&A → Mobile number`

Captured lead fields: `student_name`, `course_interest`, `qualification`,
`mobile_number`. It never asks for percentage, city, or passing year.

---

## Project layout

| Path | What it is |
|------|------------|
| [main.py](main.py) | FastAPI app — voice + admin routes, serves the React panel, `/health` |
| [app/config.py](app/config.py) | Env config (auto-detects Render's URL) |
| [app/twilio_voice.py](app/twilio_voice.py) | Twilio TwiML, TTS normalization, fillers, Sarvam STT flow |
| [app/sarvam_client.py](app/sarvam_client.py) | Bulbul TTS + Saarika STT |
| [app/audio.py](app/audio.py) | 8 kHz WAV padding for Twilio `<Play>` |
| [app/llm/](app/llm/) | Counselor prompt, offline mock, LLM dispatch |
| [app/conversation/manager.py](app/conversation/manager.py) | Per-call state, lead capture, live events |
| [app/api_admin.py](app/api_admin.py) | Admin API: stats, analytics, leads, dialer, campaigns, SSE |
| [app/data/](app/data/) | Course knowledge base, leads, campaigns |
| [web/](web/) | React admin source (Vite) — builds into [public/admin/](public/admin/) |

---

## Run locally

```bash
# 1. Python backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env          # fill in your keys (see below)
.venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 3000

# 2. Expose to Twilio (dev only)
ngrok http 3000               # put the https URL in PUBLIC_URL, restart
```

- **Admin panel:** http://localhost:3000/admin (login `admin` / `ADMIN_PASSWORD`)
- **Health:** http://localhost:3000/health
- **Outbound call:** `.venv/bin/python scripts/outbound_call.py +9198XXXXXXXX "Name"`

Point your Twilio number's *Voice webhook* at `<PUBLIC_URL>/voice/inbound` (POST).

### Rebuilding the React admin panel

```bash
cd web && npm install && npm run build   # output → public/admin/
```

---

## Environment variables

| Key | Purpose |
|-----|---------|
| `SARVAM_API_KEY` | Sarvam TTS + STT |
| `OPENAI_API_KEY` | knowledge assistant (or `LLM_API_KEY`) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | telephony |
| `STT_ENGINE` | `sarvam` (record + Saarika) — default |
| `PUBLIC_URL` | public base URL (auto-set to `RENDER_EXTERNAL_URL` on Render) |
| `ADMIN_USER` / `ADMIN_PASSWORD` | admin panel login |

Without keys the app still runs: the offline rule-based counselor + Twilio's
Google Gujarati voice keep a working demo.

---

## Deploy

Hosted on Render via GitHub — see **[DEPLOY.md](DEPLOY.md)**. Render provides a
permanent HTTPS URL (no ngrok needed in production).

## Courses in the knowledge base

B.Tech · Diploma Engineering · B.Pharm · Pharm.D · BPT (Physiotherapy) · BCA ·
MCA · BBA · MBA · B.Sc. Agriculture. The assistant **never guesses** — for
anything outside the catalogue it offers a callback from the admission team.
