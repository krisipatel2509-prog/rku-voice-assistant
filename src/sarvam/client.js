import axios from "axios";
import FormData from "form-data";
import config from "../config.js";

// ─────────────────────────────────────────────────────────────
// Sarvam AI (Bulbul) text-to-speech client.
// Renders telephony-grade Gujarati audio with clear pronunciation of
// mixed Gujarati + English. Returns base64 WAV (high sample rate); the
// audio helper downsamples to 8 kHz PCM16 for Twilio <Play>.
// When no key is set, sarvamReady() is false and callers fall back.
// ─────────────────────────────────────────────────────────────

export function sarvamReady() {
  return Boolean(config.sarvam.apiKey);
}

const TTS_URL = "https://api.sarvam.ai/text-to-speech";

export async function textToSpeech(text, { lang = "gu-IN" } = {}) {
  if (!sarvamReady() || !text) return null;
  try {
    const { data } = await axios.post(
      TTS_URL,
      {
        text,
        target_language_code: lang,
        speaker: config.sarvam.ttsSpeaker,
        model: config.sarvam.ttsModel,
        pace: config.sarvam.ttsPace,
        loudness: config.sarvam.ttsLoudness,
        speech_sample_rate: 22050, // render high, downsample to 8 kHz for telephony
        enable_preprocessing: true, // handles mixed Gujarati + English
      },
      {
        headers: {
          "api-subscription-key": config.sarvam.apiKey,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );
    const audioBase64 = data?.audios?.[0];
    return audioBase64 ? { audioBase64, samplingRate: 22050, format: "wav" } : null;
  } catch (err) {
    console.error("[sarvam] TTS error:", err.response?.data || err.message);
    return null;
  }
}

// ── Speech-to-text (Saarika) — far better Gujarati ASR than Twilio ──
const STT_URL = "https://api.sarvam.ai/speech-to-text";

export async function speechToText(audioBuffer, { lang = "gu-IN", filename = "audio.wav" } = {}) {
  if (!sarvamReady() || !audioBuffer?.length) return null;
  // The transcription endpoint expects a Saarika model; fall back to a sane
  // default if the configured model is a Saaras (translate) one.
  const model = config.sarvam.sttModel?.startsWith("saarika") ? config.sarvam.sttModel : "saarika:v2.5";
  try {
    const form = new FormData();
    form.append("file", audioBuffer, { filename, contentType: "audio/wav" });
    form.append("model", model);
    form.append("language_code", lang);
    const { data } = await axios.post(STT_URL, form, {
      headers: { "api-subscription-key": config.sarvam.apiKey, ...form.getHeaders() },
      timeout: 15000,
      maxBodyLength: Infinity,
    });
    return (data?.transcript || "").trim() || null;
  } catch (err) {
    console.error("[sarvam] STT error:", err.response?.data || err.message);
    return null;
  }
}
