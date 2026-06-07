import express from "express";
import axios from "axios";
import twilio from "twilio";
import config from "../config.js";
import { textToSpeech as bhashiniTTS, bhashiniReady } from "../bhashini/client.js";
import { textToSpeech as sarvamTTS, speechToText as sarvamSTT, sarvamReady } from "../sarvam/client.js";
import { wavBase64ToBuffer } from "../audio.js";
import { startSession, greet, handleTurn, endSession, getSession } from "../conversation/manager.js";

const { VoiceResponse } = twilio.twiml;
export const router = express.Router();

// ─────────────────────────────────────────────────────────────
// Pronunciation + number normalization (run on ALL text before TTS).
// ─────────────────────────────────────────────────────────────

// Indian-grouped amount -> spoken Gujarati words (no leading "₹"/commas).
function indianAmountToWords(n) {
  let rem = n;
  const crore = Math.floor(rem / 1e7); rem %= 1e7;
  const lakh = Math.floor(rem / 1e5); rem %= 1e5;
  const thousand = Math.floor(rem / 1e3); rem %= 1e3;
  const p = [];
  if (crore) p.push(`${crore} કરોડ`);
  if (lakh) p.push(`${lakh} લાખ`);
  if (thousand) p.push(`${thousand} હજાર`);
  if (rem) p.push(`${rem}`);
  return p.join(" ") || "0";
}

// Spell out codes/acronyms/English terms the TTS garbles (longer/dotted first).
const TTS_TERMS = [
  [/RK\s*University/gi, "આર કે યુનિવર્સિટી"],
  [/\bRKU\b/gi, "આર કે યુનિવર્સિટી"],
  [/Pharm\.?\s?D/gi, "ફાર્મ ડી"],
  [/B\.?\s?Tech/gi, "બી ટેક"],
  [/M\.?\s?Tech/gi, "એમ ટેક"],
  [/B\.?\s?Pharm/gi, "બી ફાર્મ"],
  [/M\.?\s?Pharm/gi, "એમ ફાર્મ"],
  [/B\.?\s?Com/gi, "બી કોમ"],
  [/B\.?\s?Sc/gi, "બી એસ સી"],
  [/\bBPT\b/gi, "બી પી ટી"],
  [/\bBCA\b/gi, "બી સી એ"],
  [/\bMCA\b/gi, "એમ સી એ"],
  [/\bBBA\b/gi, "બી બી એ"],
  [/\bMBA\b/gi, "એમ બી એ"],
  [/Bachelor of Business Administration/gi, "બેચલર ઓફ બિઝનેસ એડમિનિસ્ટ્રેશન"],
  [/Master of Business Administration/gi, "માસ્ટર ઓફ બિઝનેસ એડમિનિસ્ટ્રેશન"],
  [/Bachelor of Computer Applications/gi, "બેચલર ઓફ કમ્પ્યુટર એપ્લિકેશન્સ"],
  [/Master of Computer Applications/gi, "માસ્ટર ઓફ કમ્પ્યુટર એપ્લિકેશન્સ"],
  [/Doctor of Pharmacy/gi, "ડોક્ટર ઓફ ફાર્મસી"],
  [/Bachelor of Physiotherapy/gi, "બેચલર ઓફ ફિઝિયોથેરાપી"],
  [/Bachelor of Technology/gi, "બેચલર ઓફ ટેકનોલોજી"],
  [/Computer Applications/gi, "કમ્પ્યુટર એપ્લિકેશન્સ"],
  [/Bachelor of/gi, "બેચલર ઓફ"],
  [/Master of/gi, "માસ્ટર ઓફ"],
  [/\bDiploma\b/gi, "ડિપ્લોમા"],
  [/\bACPC\b/gi, "એ સી પી સી"],
  [/\bJEE\b/gi, "જે ઈ ઈ"],
  [/\bGPAT\b/gi, "જી પેટ"],
  [/\bCMAT\b/gi, "સી મેટ"],
  [/\bPCM\b/gi, "પી સી એમ"],
  [/\bPCB\b/gi, "પી સી બી"],
  [/\bPCI\b/gi, "પી સી આઈ"],
  [/\bITI\b/gi, "આઈ ટી આઈ"],
  [/\bSSC\b/gi, "એસ એસ સી"],
  [/\bHSC\b/gi, "એચ એસ સી"],
  [/\b12\s?th\b/gi, "બારમા"],
  [/\b10\s?th\b/gi, "દસમા"],
  [/\bScience\b/gi, "સાયન્સ"],
  [/\bCommerce\b/gi, "કોમર્સ"],
  [/\bEngineering\b/gi, "એન્જિનિયરિંગ"],
  [/\bPharmacy\b/gi, "ફાર્મસી"],
  [/\bPhysiotherapy\b/gi, "ફિઝિયોથેરાપી"],
  [/\bAgriculture\b/gi, "એગ્રીકલ્ચર"],
  [/\bScholarship\b/gi, "સ્કોલરશિપ"],
  [/\bPlacement\b/gi, "પ્લેસમેન્ટ"],
  [/\bSemester\b/gi, "સેમેસ્ટર"],
  [/\bQualification\b/gi, "ક્વોલિફિકેશન"],
  [/\badmission\b/gi, "એડમિશન"],
  [/\beligibility\b/gi, "એલિજિબિલિટી"],
  [/\bfees?\b/gi, "ફી"],
  [/\bcourse\b/gi, "કોર્સ"],
  [/\byear\b/gi, "વર્ષ"],
  [/\bmarks?\b/gi, "માર્ક્સ"],
  [/\bWi-?Fi\b/gi, "વાઈ ફાઈ"],
];

function normalizeForTTS(text) {
  let out = text || "";
  for (const [re, sub] of TTS_TERMS) out = out.replace(re, sub);
  const amt = (s) => indianAmountToWords(parseInt(s.replace(/,/g, ""), 10));
  return out
    .replace(/%/g, " ટકા")
    // Fee RANGES -> "85 હજાર થી 1 લાખ 15 હજાર રૂપિયા" (રૂપિયા once, at the end)
    .replace(
      /(?:₹\s?)?(\d{1,2}(?:,\d{2,3})+|\d{4,})\s*(?:થી|–|—|-|to)\s*(?:₹\s?)?(\d{1,2}(?:,\d{2,3})+|\d{4,})/gi,
      (_, a, b) => `${amt(a)} થી ${amt(b)} રૂપિયા`
    )
    .replace(/₹\s?([\d,]+)/g, (_, num) => `${amt(num)} રૂપિયા`)
    .replace(/\b(\d{1,2}(?:,\d{2,3})+)\b/g, (_, num) => amt(num))
    .trim();
}

// ─────────────────────────────────────────────────────────────
// Audio clip stores + synthesis (Sarvam → Bhashini → Google <Say>).
// ─────────────────────────────────────────────────────────────

const audioStore = new Map(); // one-shot reply clips
let audioSeq = 0;
const fillerStore = new Map(); // reusable "thinking" filler clips
const pendingTurns = new Map(); // sessionId -> in-flight handleTurn promise

// Serve a one-shot reply clip, then free it.
router.get("/audio/:id", (req, res) => {
  const clip = audioStore.get(req.params.id);
  if (!clip) return res.sendStatus(404);
  res.set("Content-Type", "audio/wav").send(clip);
  audioStore.delete(req.params.id);
});

// Serve a reusable filler clip (kept warm in memory).
router.get("/filler/:id", (req, res) => {
  const clip = fillerStore.get(req.params.id);
  if (!clip) return res.sendStatus(404);
  res.set("Content-Type", "audio/wav").send(clip);
});

// Synthesise text to a Twilio-ready WAV buffer, or null to use <Say> fallback.
async function synthClip(text) {
  const clean = normalizeForTTS(text);
  if (sarvamReady()) {
    const t = await sarvamTTS(clean, { lang: "gu-IN" });
    if (t) return wavBase64ToBuffer(t.audioBase64);
  }
  if (bhashiniReady()) {
    const t = await bhashiniTTS(text, { lang: config.defaultLanguage, samplingRate: 8000 });
    if (t) return wavBase64ToBuffer(t.audioBase64);
  }
  return null;
}

// Speak `text`: <Play> a generated clip, else Twilio Google gu-IN <Say>.
async function speak(vr, text) {
  const clip = await synthClip(text);
  if (clip) {
    const id = `c${++audioSeq}`;
    audioStore.set(id, clip);
    vr.play(`${config.publicUrl}/voice/audio/${id}`);
    return;
  }
  vr.say({ language: "gu-IN", voice: "Google.gu-IN-Standard-A" }, normalizeForTTS(text));
}

// ── Thinking fillers — pre-synthesised once, played while the LLM thinks ──
const FILLERS = [
  "હા, એક ક્ષણ...",
  "જરા જોઈ રહી છું...",
  "હમ્મ, એક સેકન્ડ...",
  "સારું, જોઉં છું...",
];
let fillersWarmed = false;

export async function warmFillers() {
  if (fillersWarmed || !sarvamReady()) return;
  for (let i = 0; i < FILLERS.length; i++) {
    const clip = await synthClip(FILLERS[i]);
    if (clip) fillerStore.set(`f${i}`, clip);
  }
  fillersWarmed = true;
}

function randomFillerUrl() {
  const ids = [...fillerStore.keys()];
  if (!ids.length) return null;
  return `${config.publicUrl}/voice/filler/${ids[Math.floor(Math.random() * ids.length)]}`;
}

// ─────────────────────────────────────────────────────────────
// Call flow
// ─────────────────────────────────────────────────────────────

// When running the Bhashini real-time path, hand the call to the media stream.
function shouldStream() {
  return config.sttEngine === "bhashini" && bhashiniReady();
}

function connectStream(vr, params = "") {
  const wsBase = config.publicUrl.replace(/^http/, "ws");
  const connect = vr.connect();
  connect.stream({ url: `${wsBase}/media-stream${params}` });
}

// Use Sarvam STT when configured (STT_ENGINE=sarvam) and we can fetch Twilio
// recordings — far more accurate Gujarati ASR than Twilio's built-in <Gather>.
function sttMode() {
  return config.sttEngine === "sarvam" && sarvamReady() && Boolean(config.twilio.accountSid);
}

// Words to bias Twilio's recogniser (used only in the <Gather> fallback path).
const SPEECH_HINTS =
  "RK University, admission, B.Tech, BCA, MCA, BBA, MBA, B.Pharm, Pharm.D, BPT, Diploma, B.Sc, Agriculture, fees, placement, scholarship, hostel, eligibility, 12th, 10th, Science, Commerce, હા, ના, રાજકોટ, અમદાવાદ, સુરત";

// Listen for the caller's reply: record (Sarvam STT) or Twilio speech <Gather>.
function listen(vr, sessionId, empties) {
  const action = `/voice/turn?sid=${encodeURIComponent(sessionId)}${empties ? `&empties=${empties}` : ""}`;
  if (sttMode()) {
    vr.record({
      action,
      method: "POST",
      maxLength: 15,
      timeout: 2, // end ~2s after the caller stops (press # to finish instantly)
      playBeep: false,
      trim: "trim-silence",
      finishOnKey: "#",
    });
    return;
  }
  vr.gather({
    input: ["speech"],
    language: "gu-IN",
    speechModel: "phone_call",
    speechTimeout: "auto",
    enhanced: true,
    hints: SPEECH_HINTS,
    actionOnEmptyResult: true,
    action,
    method: "POST",
  });
}

// Download a Twilio recording and transcribe it with Sarvam. Returns "" on failure
// (caller falls back to Twilio's own SpeechResult, if any).
async function transcribeRecording(recordingUrl) {
  const url = `${recordingUrl}.wav`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data } = await axios.get(url, {
        responseType: "arraybuffer",
        auth: { username: config.twilio.accountSid, password: config.twilio.authToken },
        timeout: 10000,
      });
      const text = await sarvamSTT(Buffer.from(data), { lang: "gu-IN" });
      return text || "";
    } catch (err) {
      // The recording may not be ready the instant the action fires — retry briefly.
      if (err.response?.status === 404 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
      console.error("[stt] recording fetch/transcribe failed:", err.response?.status || err.message);
      return "";
    }
  }
  return "";
}

// ── Inbound call entry point ─────────────────────────────────
router.post("/inbound", async (req, res) => {
  const sessionId = req.body.CallSid || `inbound-${Date.now()}`;
  const vr = new VoiceResponse();

  if (shouldStream()) {
    connectStream(vr, "?direction=inbound");
    return res.type("text/xml").send(vr.toString());
  }

  startSession(sessionId, { direction: "inbound", phone: req.body.From || "" });
  await speak(vr, await greet(sessionId));
  listen(vr, sessionId);
  res.type("text/xml").send(vr.toString());
});

// ── Outbound call entry point (Twilio fetches this when call connects) ──
router.post("/outbound", async (req, res) => {
  const sessionId = req.body.CallSid || `outbound-${Date.now()}`;
  const studentName = req.query.name || "";
  const vr = new VoiceResponse();

  if (shouldStream()) {
    connectStream(vr, `?direction=outbound&name=${encodeURIComponent(studentName)}`);
    return res.type("text/xml").send(vr.toString());
  }

  startSession(sessionId, { direction: "outbound", studentName, phone: req.body.To || "" });
  await speak(vr, await greet(sessionId));
  listen(vr, sessionId);
  res.type("text/xml").send(vr.toString());
});

// ── Each conversational turn ─────────────────────────────────
// We return a short filler clip immediately and run transcription + LLM + TTS as
// ONE background job, so all of that work overlaps the filler audio. /answer then
// plays the already-rendered reply clip (no extra dead air). The only unavoidable
// wait is the record silence timeout.
router.post("/turn", async (req, res) => {
  const sessionId = req.query.sid;
  const vr = new VoiceResponse();
  const empties = parseInt(req.query.empties || "0", 10);

  if (sttMode()) {
    const recordingUrl = req.body.RecordingUrl || "";
    const job = (async () => {
      const t0 = Date.now();
      const speech = recordingUrl ? (await transcribeRecording(recordingUrl)).trim() : "";
      const t1 = Date.now();
      if (!speech) return { empty: true, empties };
      const { reply, endCall } = await handleTurn(sessionId, speech);
      const t2 = Date.now();
      const clip = await synthClip(reply);
      let clipId = null;
      if (clip) { clipId = `c${++audioSeq}`; audioStore.set(clipId, clip); }
      console.log(`[turn] heard: "${speech}" | stt ${t1 - t0}ms · llm ${t2 - t1}ms · tts ${Date.now() - t2}ms`);
      return { reply, endCall, clipId };
    })().catch((e) => {
      console.error("[turn]", e.message);
      return { reply: "માફ કરશો, ફરી કહેશો?", endCall: false };
    });
    pendingTurns.set(sessionId, job);

    const fillerUrl = randomFillerUrl();
    if (fillerUrl) vr.play(fillerUrl);
    vr.redirect({ method: "POST" }, `/voice/answer?sid=${encodeURIComponent(sessionId)}`);
    return res.type("text/xml").send(vr.toString());
  }

  // ── Twilio Gather fallback (no Sarvam STT) ──
  const speech = (req.body.SpeechResult || "").trim();
  if (!speech) {
    const n = empties + 1;
    if (n >= 3) {
      await speak(vr, "લાગે છે અત્યારે વાત થઈ શકતી નથી. અમારી admission ટીમ ફરી સંપર્ક કરશે. આભાર!");
      endSession(sessionId);
      vr.hangup();
      return res.type("text/xml").send(vr.toString());
    }
    await speak(vr, "માફ કરશો, મને બરાબર સંભળાયું નહીં. ફરી એકવાર કહેશો?");
    listen(vr, sessionId, n);
    return res.type("text/xml").send(vr.toString());
  }
  const job = handleTurn(sessionId, speech).catch(() => ({ reply: "માફ કરશો, ફરી કહેશો?", endCall: false }));
  pendingTurns.set(sessionId, job);
  const fillerUrl = randomFillerUrl();
  if (fillerUrl) {
    vr.play(fillerUrl);
    vr.redirect({ method: "POST" }, `/voice/answer?sid=${encodeURIComponent(sessionId)}`);
    return res.type("text/xml").send(vr.toString());
  }
  const { reply, endCall } = await job;
  pendingTurns.delete(sessionId);
  await speak(vr, reply);
  endCall ? (endSession(sessionId), vr.hangup()) : listen(vr, sessionId);
  res.type("text/xml").send(vr.toString());
});

// ── Deliver the reply after the filler clip has played ───────
router.post("/answer", async (req, res) => {
  const sessionId = req.query.sid;
  const vr = new VoiceResponse();
  const job = pendingTurns.get(sessionId);
  pendingTurns.delete(sessionId);
  const r = job ? await job : { reply: "માફ કરશો, ફરી કહેશો?", endCall: false };

  // Empty transcript (STT mode) — re-prompt or close gracefully.
  if (r.empty) {
    const n = (r.empties || 0) + 1;
    if (n >= 3) {
      await speak(vr, "લાગે છે અત્યારે વાત થઈ શકતી નથી. અમારી admission ટીમ ફરી સંપર્ક કરશે. આભાર!");
      endSession(sessionId);
      vr.hangup();
      return res.type("text/xml").send(vr.toString());
    }
    await speak(vr, "માફ કરશો, મને બરાબર સંભળાયું નહીં. ફરી એકવાર કહેશો?");
    listen(vr, sessionId, n);
    return res.type("text/xml").send(vr.toString());
  }

  if (r.clipId) vr.play(`${config.publicUrl}/voice/audio/${r.clipId}`); // pre-rendered during filler
  else await speak(vr, r.reply);

  if (r.endCall) {
    endSession(sessionId);
    vr.hangup();
  } else {
    listen(vr, sessionId);
  }
  res.type("text/xml").send(vr.toString());
});
