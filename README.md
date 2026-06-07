# RK University — Gujarati Admission Voice Assistant 🎓📞

A human-like admission counselor that handles **inbound and outbound calls in Gujarati**.
It answers course queries accurately from RK University's catalogue, collects lead
information naturally (one question at a time), and schedules follow-ups.

**Stack:** Twilio (telephony) · Ngrok (tunnel) · Bhashini (STT + TTS, Gujarati) ·
pluggable LLM (Admission Knowledge Assistant) · Node.js.

> 💡 **Demo without any keys.** Out of the box (`LLM_PROVIDER=mock`, no Bhashini keys),
> the app runs a fully working **browser simulator** — Gujarati conversation, KB-accurate
> answers, and live lead capture — using a rule-based counselor + the browser's own
> speech engine. Add real keys to upgrade to phone calls + Bhashini voice.

---

## Quick start (browser demo, zero keys)

```bash
npm install
cp .env.example .env      # defaults already run in mock mode
npm start
```

Open **http://localhost:3000** → choose Inbound/Outbound → **Start Call** → speak (🎙️) or type in Gujarati.
Watch the **Captured Lead** panel fill in live. Leads are saved to `leads.json`.

---

## Admin panel (React SPA) 🖥️

A full admin dashboard lives in [web/](web/) (Vite + React). It has **login, dashboard,
dialer, live call monitor, campaigns, analytics, and a leads table**.

```bash
# one-time: install admin deps
cd web && npm install

# build it (output goes to public/admin/, served by the backend)
npm run build
```

Then with the server running, open **http://localhost:3000/admin** and log in
(default `admin` / `rku123`, configurable via `ADMIN_USER` / `ADMIN_PASSWORD` in `.env`).

**Live-reloading dev mode** (optional, two terminals):
```bash
npm start                 # terminal 1 — backend on :3000
cd web && npm run dev      # terminal 2 — admin on :5173 (proxies /api to :3000)
```

| Screen | What it does |
|--------|--------------|
| Dashboard | Totals, conversion %, calls today, live-call count, recent leads |
| Dialer | Click-to-call a single number via Twilio |
| Live Monitor | Real-time active calls + transcripts (Server-Sent Events) |
| Campaigns | Bulk outbound lists, run-all dialing, per-call results |
| Analytics | Leads/day, course interest, city, inbound-vs-outbound charts |
| Leads | Searchable, filterable table with CSV export |

Admin API lives under `/api/admin/*` (token-gated) — see [src/api/admin.js](src/api/admin.js).

---

## Architecture

```
Caller ─▶ Twilio ─▶ (ngrok) ─▶ Express server
                                  │
        ┌─────────────────────────┼──────────────────────────┐
        │  STT_ENGINE=twilio       │   STT_ENGINE=bhashini      │
        │  <Gather speech gu-IN>   │   <Connect><Stream> (WS)   │
        │                          │   μ-law ⇄ Bhashini ASR     │
        └─────────────┬────────────┴───────────┬────────────────┘
                      ▼                         ▼
              Conversation Manager (per-call state, slot-filling)
                      │
        ┌─────────────┼───────────────┐
        ▼             ▼               ▼
  Admission LLM   Course KB      Bhashini TTS (Gujarati voice)
 (anthropic /    (10 RKU         ─▶ <Play> / streamed μ-law
  openai / mock)  programs)
                      │
                      ▼
              leads.json  (name, mobile, city, course, %, year, …)
```

| Path | What it does |
|------|--------------|
| [src/server.js](src/server.js) | Express app, simulator API, boots the media-stream WS |
| [src/config.js](src/config.js) | Env config + readiness checks |
| [src/twilio/voice.js](src/twilio/voice.js) | Inbound/outbound TwiML, `<Gather>` turns, TTS playback |
| [src/twilio/mediaStream.js](src/twilio/mediaStream.js) | Real-time μ-law WebSocket path + VAD (Bhashini STT) |
| [src/bhashini/client.js](src/bhashini/client.js) | ULCA pipeline config, ASR + TTS calls |
| [src/llm/assistant.js](src/llm/assistant.js) | LLM dispatch (anthropic / openai / mock) |
| [src/llm/prompt.js](src/llm/prompt.js) | Gujarati counselor persona + scripts + KB |
| [src/llm/mock.js](src/llm/mock.js) | Offline KB-driven counselor (no keys needed) |
| [src/conversation/manager.js](src/conversation/manager.js) | Dialogue state, lead capture, callback |
| [src/data/courses.js](src/data/courses.js) | 10 RKU programs (scraped from rku.ac.in) |
| [public/index.html](public/index.html) | Browser call simulator |

---

## Going live (real phone calls)

1. **Fill `.env`:**
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
   - `BHASHINI_USER_ID`, `BHASHINI_UDYAT_KEY`, `BHASHINI_INFERENCE_KEY`
   - `LLM_PROVIDER=anthropic` (+ `LLM_API_KEY`) or an OpenAI-compatible endpoint
   - `STT_ENGINE=bhashini` for low-latency streaming ASR, or `twilio` for `<Gather>`
2. **Tunnel:** `npm run tunnel` (ngrok) → copy the https URL into `PUBLIC_URL`, restart.
3. **Inbound:** in the Twilio console, set your number's *Voice webhook* to
   `https://<your-ngrok>/voice/inbound` (HTTP POST).
4. **Outbound:** `npm run call -- +9198XXXXXXXX "Student Name"`

The `/health` endpoint shows whether Bhashini/LLM are configured or running in mock mode.

---

## Lead fields captured

`student_name`, `mobile_number`, `city`, `course_interest`, `qualification`,
`passing_year`, `percentage`, `preferred_language` — asked **one at a time**, never all at once.

## Courses in the knowledge base

B.Tech · Diploma Engineering · B.Pharm · Pharm.D · BPT (Physiotherapy) · BCA · MCA · BBA · MBA · B.Sc. Agriculture.
The assistant **never guesses** — for anything outside the KB it offers a callback from the admission team.

---

## Meeting the demo success criteria

- **Human-like, warm Gujarati** — persona prompt enforces short sentences, fillers, no monotone.
- **Pronunciation** — key terms (University, Pharmacy, Physiotherapy, Rajkot…) kept in Latin script in TTS text so Bhashini articulates them correctly.
- **< 3s latency** — streaming μ-law path + 8 kHz TTS; turn work is a single ASR→LLM→TTS hop.
- **Lead capture + follow-up** — every turn is persisted to `leads.json`; callback time is detected on busy outbound calls.
- **Inbound & outbound** — separate scripts/greetings, same conversation core.
