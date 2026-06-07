import dotenv from "dotenv";
dotenv.config();

const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  publicUrl: (process.env.PUBLIC_URL || "").replace(/\/$/, ""),

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || "",
  },

  bhashini: {
    userId: process.env.BHASHINI_USER_ID || "",
    udyatKey: process.env.BHASHINI_UDYAT_KEY || "",
    inferenceKey: process.env.BHASHINI_INFERENCE_KEY || "",
    pipelineId: process.env.BHASHINI_PIPELINE_ID || "64392f96daac500b55c543cd",
    configUrl:
      "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline",
    // The actual inference endpoint is returned by the config call, but this is
    // the stable default for the MeitY pipeline.
    inferenceUrl:
      "https://dhruva-api.bhashini.gov.in/services/inference/pipeline",
  },

  // Sarvam AI (Bulbul) — primary TTS, optional Saaras STT.
  sarvam: {
    apiKey: process.env.SARVAM_API_KEY || "",
    sttModel: process.env.SARVAM_STT_MODEL || "saaras:v3",
    ttsModel: process.env.SARVAM_TTS_MODEL || "bulbul:v2",
    ttsSpeaker: process.env.SARVAM_TTS_SPEAKER || "anushka",
    ttsPace: parseFloat(process.env.SARVAM_TTS_PACE || "1.0"),
    ttsLoudness: parseFloat(process.env.SARVAM_TTS_LOUDNESS || "1.0"),
  },

  llm: {
    // Fall back to OPENAI_* so an OpenAI key alone is enough to go live.
    provider: (process.env.LLM_PROVIDER || (process.env.OPENAI_API_KEY ? "openai" : "mock")).toLowerCase(),
    model: process.env.LLM_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
    apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "",
    baseUrl: process.env.LLM_BASE_URL || "",
  },

  sttEngine: (process.env.STT_ENGINE || "twilio").toLowerCase(),
  defaultLanguage: process.env.DEFAULT_LANGUAGE || "gu",

  admin: {
    user: process.env.ADMIN_USER || "admin",
    password: process.env.ADMIN_PASSWORD || "rku123",
  },
};

export function bhashiniReady() {
  const b = config.bhashini;
  return Boolean(b.userId && b.udyatKey && b.inferenceKey);
}

export function llmReady() {
  return config.llm.provider !== "mock" && Boolean(config.llm.apiKey);
}

export default config;
