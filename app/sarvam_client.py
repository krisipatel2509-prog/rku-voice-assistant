"""Sarvam AI (Bulbul TTS + Saarika STT) client — ported from src/sarvam/client.js.

TTS is requested at 8 kHz (telephony rate) so no resampling is needed for Twilio.
"""
import httpx

from .config import config

TTS_URL = "https://api.sarvam.ai/text-to-speech"
STT_URL = "https://api.sarvam.ai/speech-to-text"


def sarvam_ready() -> bool:
    return bool(config.sarvam.api_key)


async def text_to_speech(text: str, lang: str = "gu-IN"):
    """Return a base64 WAV string (8 kHz PCM16 mono), or None."""
    if not sarvam_ready() or not text:
        return None
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                TTS_URL,
                json={
                    "text": text,
                    "target_language_code": lang,
                    "speaker": config.sarvam.tts_speaker,
                    "model": config.sarvam.tts_model,
                    "pace": config.sarvam.tts_pace,
                    "loudness": config.sarvam.tts_loudness,
                    "speech_sample_rate": 8000,   # telephony rate — Twilio plays 8 kHz
                    "enable_preprocessing": True,  # handles mixed Gujarati + English
                },
                headers={"api-subscription-key": config.sarvam.api_key, "Content-Type": "application/json"},
            )
            r.raise_for_status()
            audios = r.json().get("audios") or []
            return audios[0] if audios else None
    except Exception as e:
        print("[sarvam] TTS error:", getattr(getattr(e, "response", None), "text", str(e)))
        return None


async def speech_to_text(audio_bytes: bytes, lang: str = "gu-IN"):
    """Transcribe WAV audio with Saarika. Returns text or None."""
    if not sarvam_ready() or not audio_bytes:
        return None
    model = config.sarvam.stt_model if (config.sarvam.stt_model or "").startswith("saarika") else "saarika:v2.5"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                STT_URL,
                headers={"api-subscription-key": config.sarvam.api_key},
                data={"model": model, "language_code": lang},
                files={"file": ("audio.wav", audio_bytes, "audio/wav")},
            )
            r.raise_for_status()
            return (r.json().get("transcript") or "").strip() or None
    except Exception as e:
        print("[sarvam] STT error:", getattr(getattr(e, "response", None), "text", str(e)))
        return None
