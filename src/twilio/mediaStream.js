import { WebSocketServer } from "ws";
import config from "../config.js";
import { speechToText, textToSpeech } from "../bhashini/client.js";
import { mulaw8kToWav16kBase64, wavBase64ToMulaw8kBase64 } from "../audio.js";
import { startSession, greet, handleTurn, endSession } from "../conversation/manager.js";

// ─────────────────────────────────────────────────────────────
// Twilio <Stream> handler: real-time μ-law audio over WebSocket.
// Simple energy-based VAD chops the caller's speech into utterances,
// each utterance runs ASR -> assistant -> TTS, streamed back as μ-law.
// This is the low-latency path used when STT_ENGINE=bhashini.
// ─────────────────────────────────────────────────────────────

const FRAME_BYTES = 160; // 20ms @ 8kHz μ-law
const SILENCE_FRAMES = 35; // ~700ms of silence ends an utterance
const ENERGY_THRESHOLD = 600;
const MIN_SPEECH_FRAMES = 10; // ignore blips < 200ms

function muLawDecode(uVal) {
  uVal = ~uVal & 0xff;
  let t = ((uVal & 0x0f) << 3) + 0x84;
  t <<= (uVal & 0x70) >> 4;
  return (uVal & 0x80 ? 0x84 - t : t - 0x84);
}

function frameEnergy(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += Math.abs(muLawDecode(buf[i]));
  return sum / buf.length;
}

export function attachMediaStream(server) {
  const wss = new WebSocketServer({ server, path: "/media-stream" });

  wss.on("connection", (ws, req) => {
    let streamSid = null;
    let sessionId = null;
    let direction = "inbound";
    let studentName = "";

    let speechFrames = [];
    let speaking = false;
    let silenceCount = 0;
    let busy = false; // true while ASR/LLM/TTS in flight

    const url = new URL(req.url, "http://x");
    direction = url.searchParams.get("direction") || "inbound";
    studentName = url.searchParams.get("name") || "";

    const sendAudio = (mulawBase64) => {
      // Twilio expects ~20ms chunks; send in 160-byte slices.
      const raw = Buffer.from(mulawBase64, "base64");
      for (let i = 0; i < raw.length; i += FRAME_BYTES) {
        const chunk = raw.subarray(i, i + FRAME_BYTES).toString("base64");
        ws.send(JSON.stringify({ event: "media", streamSid, media: { payload: chunk } }));
      }
    };

    const say = async (text) => {
      const tts = await textToSpeech(text, { lang: config.defaultLanguage, samplingRate: 8000 });
      if (tts) sendAudio(wavBase64ToMulaw8kBase64(tts.audioBase64));
    };

    const finalizeUtterance = async () => {
      if (busy || speechFrames.length < MIN_SPEECH_FRAMES) {
        speechFrames = [];
        speaking = false;
        return;
      }
      busy = true;
      const mulaw = Buffer.concat(speechFrames);
      speechFrames = [];
      speaking = false;
      try {
        const wavB64 = mulaw8kToWav16kBase64(mulaw);
        const text = await speechToText(wavB64, { lang: config.defaultLanguage, samplingRate: 16000 });
        if (text) {
          const { reply, endCall } = await handleTurn(sessionId, text);
          await say(reply);
          if (endCall) {
            endSession(sessionId);
            ws.send(JSON.stringify({ event: "mark", streamSid, mark: { name: "end" } }));
          }
        }
      } catch (err) {
        console.error("[media] turn error:", err.message);
      } finally {
        busy = false;
      }
    };

    ws.on("message", async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.event === "start") {
        streamSid = msg.start.streamSid;
        sessionId = msg.start.callSid || streamSid;
        startSession(sessionId, { direction, studentName });
        await say(await greet(sessionId)); // opening line
      } else if (msg.event === "media") {
        if (busy) return; // don't capture while we're talking
        const frame = Buffer.from(msg.media.payload, "base64");
        const energy = frameEnergy(frame);
        if (energy > ENERGY_THRESHOLD) {
          speaking = true;
          silenceCount = 0;
          speechFrames.push(frame);
        } else if (speaking) {
          silenceCount++;
          speechFrames.push(frame);
          if (silenceCount >= SILENCE_FRAMES) await finalizeUtterance();
        }
      } else if (msg.event === "stop") {
        if (sessionId) endSession(sessionId);
        ws.close();
      }
    });

    ws.on("close", () => {
      if (sessionId) endSession(sessionId);
    });
  });

  console.log("[media] WebSocket ready at /media-stream");
}
