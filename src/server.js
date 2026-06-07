import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

import config, { bhashiniReady, llmReady } from "./config.js";
import { router as voiceRouter, warmFillers } from "./twilio/voice.js";
import { router as adminRouter } from "./api/admin.js";
import { attachMediaStream } from "./twilio/mediaStream.js";
import { sarvamReady } from "./sarvam/client.js";

function ttsProvider() {
  if (sarvamReady()) return `sarvam (${config.sarvam.ttsModel}/${config.sarvam.ttsSpeaker})`;
  if (bhashiniReady()) return "bhashini";
  return "twilio-google (fallback)";
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Root → admin panel (the browser simulator has been removed).
app.get("/", (_req, res) => res.redirect("/admin"));

// ── Twilio voice webhooks ────────────────────────────────────
app.use("/voice", voiceRouter);

// ── Admin panel API (auth, dashboard, analytics, dialer, …) ──
app.use("/api/admin", adminRouter);

// ── Health / status ──────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    tts: ttsProvider(),
    bhashini: bhashiniReady() ? "configured" : "mock",
    llm: llmReady() ? config.llm.provider : "mock",
    sttEngine: config.sttEngine,
    publicUrl: config.publicUrl || "(set PUBLIC_URL for phone calls)",
  });
});

// ── Admin SPA (built by Vite into public/admin) ──────────────
const adminDist = path.join(__dirname, "..", "public", "admin");
app.use("/admin", express.static(adminDist));
// Client-side routing fallback: any /admin/* path serves index.html.
app.get(/^\/admin(\/.*)?$/, (_req, res) => {
  res.sendFile(path.join(adminDist, "index.html"), (err) => {
    if (err) res.status(404).send("Admin panel not built yet — run: cd web && npm install && npm run build");
  });
});

// ── Boot ─────────────────────────────────────────────────────
const server = http.createServer(app);
attachMediaStream(server);

server.listen(config.port, () => {
  console.log("\n  RK University — Admission Voice Assistant");
  console.log("  ─────────────────────────────────────────");
  console.log(`  Local:     http://localhost:${config.port}`);
  console.log(`  Admin:     http://localhost:${config.port}/admin`);
  console.log(`  TTS:       ${ttsProvider()}`);
  console.log(`  Bhashini:  ${bhashiniReady() ? "configured ✓" : "mock (no keys)"}`);
  console.log(`  LLM:       ${llmReady() ? config.llm.provider + " ✓" : "mock (KB-driven)"}`);
  console.log(`  STT path:  ${config.sttEngine}`);
  if (config.publicUrl) {
    console.log(`\n  Twilio inbound webhook : ${config.publicUrl}/voice/inbound`);
    console.log(`  Twilio outbound TwiML  : ${config.publicUrl}/voice/outbound`);
  } else {
    console.log("\n  (Set PUBLIC_URL + ngrok to enable phone calls)");
  }
  console.log("");

  // Pre-synthesise the "thinking" fillers so the first slow turn isn't silent.
  warmFillers()
    .then(() => sarvamReady() && console.log("  Fillers pre-cached ✓\n"))
    .catch((e) => console.warn("[fillers] warm failed:", e.message));
});
