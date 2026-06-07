"""Environment configuration (mirrors the Node src/config.js)."""
import os
from dotenv import load_dotenv

load_dotenv()


def _f(name, default):
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return float(default)


class _Twilio:
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "")
    phone_number = os.environ.get("TWILIO_PHONE_NUMBER", "")


class _Sarvam:
    api_key = os.environ.get("SARVAM_API_KEY", "")
    stt_model = os.environ.get("SARVAM_STT_MODEL", "saaras:v3")
    tts_model = os.environ.get("SARVAM_TTS_MODEL", "bulbul:v2")
    tts_speaker = os.environ.get("SARVAM_TTS_SPEAKER", "anushka")
    tts_pace = _f("SARVAM_TTS_PACE", "1.0")
    tts_loudness = _f("SARVAM_TTS_LOUDNESS", "1.0")


class _Bhashini:
    user_id = os.environ.get("BHASHINI_USER_ID", "")
    udyat_key = os.environ.get("BHASHINI_UDYAT_KEY", "")
    inference_key = os.environ.get("BHASHINI_INFERENCE_KEY", "")
    pipeline_id = os.environ.get("BHASHINI_PIPELINE_ID", "64392f96daac500b55c543cd")
    config_url = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"
    inference_url = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"


class _Llm:
    provider = (os.environ.get("LLM_PROVIDER") or ("openai" if os.environ.get("OPENAI_API_KEY") else "mock")).lower()
    model = os.environ.get("LLM_MODEL") or os.environ.get("OPENAI_MODEL") or "gpt-4o-mini"
    api_key = os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY") or ""
    base_url = os.environ.get("LLM_BASE_URL", "")


class _Admin:
    user = os.environ.get("ADMIN_USER", "admin")
    password = os.environ.get("ADMIN_PASSWORD", "rku123")


class config:
    port = int(os.environ.get("PORT", "8000"))
    # On Render, RENDER_EXTERNAL_URL is injected automatically (no ngrok needed).
    public_url = (os.environ.get("PUBLIC_URL") or os.environ.get("RENDER_EXTERNAL_URL") or "").rstrip("/")
    stt_engine = (os.environ.get("STT_ENGINE", "twilio") or "twilio").lower()
    default_language = os.environ.get("DEFAULT_LANGUAGE", "gu")
    twilio = _Twilio
    sarvam = _Sarvam
    bhashini = _Bhashini
    llm = _Llm
    admin = _Admin


def bhashini_ready() -> bool:
    b = config.bhashini
    return bool(b.user_id and b.udyat_key and b.inference_key)


def llm_ready() -> bool:
    return config.llm.provider != "mock" and bool(config.llm.api_key)
