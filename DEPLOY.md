# Deploying to Render (via GitHub)

The Python/FastAPI backend serves both the Twilio voice webhooks and the React
admin panel. Render gives a permanent HTTPS URL, so **ngrok is not needed in
production** — the app reads `RENDER_EXTERNAL_URL` automatically.

## 1. Create the web service
1. Push this repo to GitHub (done).
2. On <https://dashboard.render.com> → **New → Blueprint**, pick this repo.
   Render reads [render.yaml](render.yaml) and creates the service.
   *(Or New → Web Service, runtime **Python**, with:)*
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Health check path: `/health`

## 2. Set the secret environment variables (Render dashboard → Environment)
| Key | Value |
|-----|-------|
| `SARVAM_API_KEY` | your Sarvam key |
| `OPENAI_API_KEY` | your OpenAI key |
| `TWILIO_ACCOUNT_SID` | from Twilio |
| `TWILIO_AUTH_TOKEN` | from Twilio |
| `TWILIO_PHONE_NUMBER` | your Twilio number (+E.164) |
| `ADMIN_PASSWORD` | admin panel password |

The non-secret vars (`STT_ENGINE=sarvam`, `LLM_PROVIDER=openai`, etc.) are already
in `render.yaml`.

## 3. Point Twilio at Render
After the first deploy you get a URL like `https://rku-voice-assistant.onrender.com`.
In the Twilio Console → your number → **Voice → A call comes in** (HTTP POST):

```
https://<your-service>.onrender.com/voice/inbound
```

Admin panel: `https://<your-service>.onrender.com/admin`

## Notes
- **Free plan sleeps** after ~15 min idle; the first call after that cold-starts
  (~30–60s) and may miss the Twilio webhook. Use the **Starter** instance for a
  reliable phone demo.
- **Leads are ephemeral** on Render's disk (reset on each deploy/restart). To
  persist, attach a Render **Disk**, mount it (e.g. `/data`), and set
  `DATA_DIR=/data` — `leads.json`/`campaigns.json` will live there.
- The built React panel is committed under `public/admin/`. If you change the
  React app, rebuild it (`cd web && npm run build`) and commit before pushing.
