import axios from "axios";
import config, { bhashiniReady } from "../config.js";

// ─────────────────────────────────────────────────────────────
// Bhashini (ULCA / Dhruva) client — ASR (speech-to-text),
// TTS (text-to-speech) and optional NMT, all for Gujarati.
//
// Two keys are involved:
//   UDYAT key      -> the ULCA API key used to fetch the pipeline config.
//   Inference key  -> the authorization token used on the inference call.
//
// We fetch the pipeline config once to discover the per-task serviceId,
// then cache it. If config fetch fails we fall back to the inference key
// directly. When keys are missing, every method resolves to null so the
// rest of the app can degrade gracefully (mock voice / Twilio STT).
// ─────────────────────────────────────────────────────────────

let pipelineCache = null;

async function getPipeline() {
  if (pipelineCache) return pipelineCache;
  if (!bhashiniReady()) return null;

  try {
    const { data } = await axios.post(
      config.bhashini.configUrl,
      {
        pipelineTasks: [
          { taskType: "asr", config: { language: { sourceLanguage: config.defaultLanguage } } },
          { taskType: "tts", config: { language: { sourceLanguage: config.defaultLanguage } } },
        ],
        pipelineRequestConfig: { pipelineId: config.bhashini.pipelineId },
      },
      {
        headers: {
          userID: config.bhashini.userId,
          ulcaApiKey: config.bhashini.udyatKey,
          "Content-Type": "application/json",
        },
        timeout: 8000,
      }
    );

    const endpoint = data?.pipelineInferenceAPIEndPoint;
    const serviceFor = (type) =>
      data?.pipelineResponseConfig?.find((p) => p.taskType === type)
        ?.config?.[0]?.serviceId;

    pipelineCache = {
      inferenceUrl: endpoint?.callbackUrl || config.bhashini.inferenceUrl,
      authName: endpoint?.inferenceApiKey?.name || "Authorization",
      authValue: endpoint?.inferenceApiKey?.value || config.bhashini.inferenceKey,
      asrServiceId: serviceFor("asr"),
      ttsServiceId: serviceFor("tts"),
    };
    return pipelineCache;
  } catch (err) {
    console.warn("[bhashini] pipeline config failed, using direct inference key:", err.message);
    pipelineCache = {
      inferenceUrl: config.bhashini.inferenceUrl,
      authName: "Authorization",
      authValue: config.bhashini.inferenceKey,
      asrServiceId: undefined,
      ttsServiceId: undefined,
    };
    return pipelineCache;
  }
}

async function callInference(body) {
  const p = await getPipeline();
  if (!p) return null;
  const { data } = await axios.post(p.inferenceUrl, body, {
    headers: { [p.authName]: p.authValue, "Content-Type": "application/json" },
    timeout: 12000,
  });
  return data;
}

/**
 * Speech-to-text. `audioBase64` must be base64-encoded WAV (PCM16).
 * Returns the recognised Gujarati text, or null on failure.
 */
export async function speechToText(audioBase64, { lang = config.defaultLanguage, samplingRate = 16000 } = {}) {
  if (!bhashiniReady()) return null;
  const p = await getPipeline();
  try {
    const data = await callInference({
      pipelineTasks: [
        {
          taskType: "asr",
          config: {
            language: { sourceLanguage: lang },
            serviceId: p.asrServiceId,
            audioFormat: "wav",
            samplingRate,
          },
        },
      ],
      inputData: { audio: [{ audioContent: audioBase64 }] },
    });
    return data?.pipelineResponse?.[0]?.output?.[0]?.source?.trim() || null;
  } catch (err) {
    console.error("[bhashini] ASR error:", err.response?.data || err.message);
    return null;
  }
}

/**
 * Text-to-speech. Returns { audioBase64, samplingRate, format } or null.
 * Bhashini returns base64 WAV by default.
 */
export async function textToSpeech(text, { lang = config.defaultLanguage, gender = "female", samplingRate = 8000 } = {}) {
  if (!bhashiniReady() || !text) return null;
  const p = await getPipeline();
  try {
    const data = await callInference({
      pipelineTasks: [
        {
          taskType: "tts",
          config: {
            language: { sourceLanguage: lang },
            serviceId: p.ttsServiceId,
            gender,
            samplingRate,
          },
        },
      ],
      inputData: { input: [{ source: text }] },
    });
    const audioBase64 = data?.pipelineResponse?.[0]?.audio?.[0]?.audioContent;
    return audioBase64 ? { audioBase64, samplingRate, format: "wav" } : null;
  } catch (err) {
    console.error("[bhashini] TTS error:", err.response?.data || err.message);
    return null;
  }
}

export { bhashiniReady };
