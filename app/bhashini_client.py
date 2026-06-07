"""Bhashini fallback TTS/STT stub (ported intent from src/bhashini/client.js).

Kept as a graceful no-op fallback: when Bhashini keys aren't set (current setup
uses Sarvam), these resolve to None so callers fall through to the next engine.
The full ULCA pipeline can be implemented here later if needed.
"""
from .config import config, bhashini_ready  # re-exported

__all__ = ["bhashini_ready", "text_to_speech", "speech_to_text"]


async def text_to_speech(text: str, lang: str = "gu", sampling_rate: int = 8000):
    return None


async def speech_to_text(audio_base64: str, lang: str = "gu", sampling_rate: int = 16000):
    return None
