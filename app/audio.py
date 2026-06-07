"""Audio helpers (ported from src/audio.js).

Twilio <Play> wants 16-bit PCM mono @ 8 kHz, and it clips the first ~150 ms of
every clip. We request Sarvam audio at 8 kHz directly (telephony rate, no
resampling needed) and pad silence at the start/end so no phoneme is eaten.
"""
import base64
import io
import wave

LEAD_SAMPLES = 2000   # ~250 ms @ 8 kHz
TRAIL_SAMPLES = 800   # ~100 ms @ 8 kHz


def wav_base64_to_buffer(wav_base64: str) -> bytes:
    """Decode a base64 WAV and pad lead/trail silence; return WAV bytes."""
    raw = base64.b64decode(wav_base64)
    try:
        with wave.open(io.BytesIO(raw), "rb") as w:
            nch = w.getnchannels()
            sw = w.getsampwidth()
            fr = w.getframerate()
            frames = w.readframes(w.getnframes())

        silence = lambda n: b"\x00" * (n * sw * nch)
        out = silence(LEAD_SAMPLES) + frames + silence(TRAIL_SAMPLES)

        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(nch)
            w.setsampwidth(sw)
            w.setframerate(fr)
            w.writeframes(out)
        return buf.getvalue()
    except Exception:
        # Worst case, hand back the raw bytes (Twilio may still play a plain WAV).
        return raw
