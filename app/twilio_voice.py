"""Twilio voice webhooks (ported from src/twilio/voice.js).

TTS routing (Sarvam -> Google <Say> fallback), pronunciation/number normalization,
thinking fillers, Sarvam STT via <Record>, and the latency-optimized flow where
transcription + LLM + TTS run concurrently while the filler plays.
"""
import asyncio
import itertools
import random
import re
import time

import httpx
from fastapi import APIRouter, Request, Response
from twilio.twiml.voice_response import VoiceResponse

from .config import config
from .sarvam_client import text_to_speech as sarvam_tts, speech_to_text as sarvam_stt, sarvam_ready
from .bhashini_client import text_to_speech as bhashini_tts, bhashini_ready
from .audio import wav_base64_to_buffer
from .conversation.manager import start_session, greet, handle_turn, end_session, get_session

router = APIRouter(prefix="/voice")

# ── Pronunciation + number normalization ─────────────────────

def indian_amount_to_words(n: int) -> str:
    rem = n
    crore, rem = divmod(rem, 10_000_000)
    lakh, rem = divmod(rem, 100_000)
    thousand, rem = divmod(rem, 1000)
    p = []
    if crore:
        p.append(f"{crore} કરોડ")
    if lakh:
        p.append(f"{lakh} લાખ")
    if thousand:
        p.append(f"{thousand} હજાર")
    if rem:
        p.append(f"{rem}")
    return " ".join(p) or "0"


TTS_TERMS = [
    (re.compile(r"RK\s*University", re.I), "આર કે યુનિવર્સિટી"),
    (re.compile(r"\bRKU\b", re.I), "આર કે યુનિવર્સિટી"),
    (re.compile(r"Pharm\.?\s?D", re.I), "ફાર્મ ડી"),
    (re.compile(r"B\.?\s?Tech", re.I), "બી ટેક"),
    (re.compile(r"M\.?\s?Tech", re.I), "એમ ટેક"),
    (re.compile(r"B\.?\s?Pharm", re.I), "બી ફાર્મ"),
    (re.compile(r"M\.?\s?Pharm", re.I), "એમ ફાર્મ"),
    (re.compile(r"B\.?\s?Com", re.I), "બી કોમ"),
    (re.compile(r"B\.?\s?Sc", re.I), "બી એસ સી"),
    (re.compile(r"\bBPT\b", re.I), "બી પી ટી"),
    (re.compile(r"\bBCA\b", re.I), "બી સી એ"),
    (re.compile(r"\bMCA\b", re.I), "એમ સી એ"),
    (re.compile(r"\bBBA\b", re.I), "બી બી એ"),
    (re.compile(r"\bMBA\b", re.I), "એમ બી એ"),
    (re.compile(r"Bachelor of Business Administration", re.I), "બેચલર ઓફ બિઝનેસ એડમિનિસ્ટ્રેશન"),
    (re.compile(r"Master of Business Administration", re.I), "માસ્ટર ઓફ બિઝનેસ એડમિનિસ્ટ્રેશન"),
    (re.compile(r"Bachelor of Computer Applications", re.I), "બેચલર ઓફ કમ્પ્યુટર એપ્લિકેશન્સ"),
    (re.compile(r"Master of Computer Applications", re.I), "માસ્ટર ઓફ કમ્પ્યુટર એપ્લિકેશન્સ"),
    (re.compile(r"Doctor of Pharmacy", re.I), "ડોક્ટર ઓફ ફાર્મસી"),
    (re.compile(r"Bachelor of Physiotherapy", re.I), "બેચલર ઓફ ફિઝિયોથેરાપી"),
    (re.compile(r"Bachelor of Technology", re.I), "બેચલર ઓફ ટેકનોલોજી"),
    (re.compile(r"Computer Applications", re.I), "કમ્પ્યુટર એપ્લિકેશન્સ"),
    (re.compile(r"Bachelor of", re.I), "બેચલર ઓફ"),
    (re.compile(r"Master of", re.I), "માસ્ટર ઓફ"),
    (re.compile(r"\bDiploma\b", re.I), "ડિપ્લોમા"),
    (re.compile(r"\bACPC\b", re.I), "એ સી પી સી"),
    (re.compile(r"\bJEE\b", re.I), "જે ઈ ઈ"),
    (re.compile(r"\bGPAT\b", re.I), "જી પેટ"),
    (re.compile(r"\bCMAT\b", re.I), "સી મેટ"),
    (re.compile(r"\bPCM\b", re.I), "પી સી એમ"),
    (re.compile(r"\bPCB\b", re.I), "પી સી બી"),
    (re.compile(r"\bPCI\b", re.I), "પી સી આઈ"),
    (re.compile(r"\bITI\b", re.I), "આઈ ટી આઈ"),
    (re.compile(r"\bSSC\b", re.I), "એસ એસ સી"),
    (re.compile(r"\bHSC\b", re.I), "એચ એસ સી"),
    (re.compile(r"\b12\s?th\b", re.I), "બારમા"),
    (re.compile(r"\b10\s?th\b", re.I), "દસમા"),
    (re.compile(r"\bScience\b", re.I), "સાયન્સ"),
    (re.compile(r"\bCommerce\b", re.I), "કોમર્સ"),
    (re.compile(r"\bEngineering\b", re.I), "એન્જિનિયરિંગ"),
    (re.compile(r"\bPharmacy\b", re.I), "ફાર્મસી"),
    (re.compile(r"\bPhysiotherapy\b", re.I), "ફિઝિયોથેરાપી"),
    (re.compile(r"\bAgriculture\b", re.I), "એગ્રીકલ્ચર"),
    (re.compile(r"\bScholarship\b", re.I), "સ્કોલરશિપ"),
    (re.compile(r"\bPlacement\b", re.I), "પ્લેસમેન્ટ"),
    (re.compile(r"\bSemester\b", re.I), "સેમેસ્ટર"),
    (re.compile(r"\bQualification\b", re.I), "ક્વોલિફિકેશન"),
    (re.compile(r"\badmission\b", re.I), "એડમિશન"),
    (re.compile(r"\beligibility\b", re.I), "એલિજિબિલિટી"),
    (re.compile(r"\bfees?\b", re.I), "ફી"),
    (re.compile(r"\bcourse\b", re.I), "કોર્સ"),
    (re.compile(r"\byear\b", re.I), "વર્ષ"),
    (re.compile(r"\bmarks?\b", re.I), "માર્ક્સ"),
    (re.compile(r"\bWi-?Fi\b", re.I), "વાઈ ફાઈ"),
]

_RANGE_RE = re.compile(
    r"(?:₹\s?)?(\d{1,2}(?:,\d{2,3})+|\d{4,})\s*(?:થી|–|—|-|to)\s*(?:₹\s?)?(\d{1,2}(?:,\d{2,3})+|\d{4,})", re.I)
_RUPEE_RE = re.compile(r"₹\s?([\d,]+)")
_GROUP_RE = re.compile(r"\b(\d{1,2}(?:,\d{2,3})+)\b")


def _amt(s: str) -> str:
    return indian_amount_to_words(int(s.replace(",", "")))


def normalize_for_tts(text: str) -> str:
    out = text or ""
    for pat, sub in TTS_TERMS:
        out = pat.sub(sub, out)
    out = out.replace("%", " ટકા")
    out = _RANGE_RE.sub(lambda m: f"{_amt(m.group(1))} થી {_amt(m.group(2))} રૂપિયા", out)
    out = _RUPEE_RE.sub(lambda m: f"{_amt(m.group(1))} રૂપિયા", out)
    out = _GROUP_RE.sub(lambda m: _amt(m.group(1)), out)
    return out.strip()


# ── Audio clip stores + synthesis ────────────────────────────
audio_store = {}
filler_store = {}
pending_turns = {}
_seq = itertools.count(1)


def _next_id():
    return f"c{next(_seq)}"


def _xml(vr):
    return Response(content=str(vr), media_type="text/xml")


@router.get("/audio/{cid}")
async def get_audio(cid: str):
    clip = audio_store.pop(cid, None)
    if clip is None:
        return Response(status_code=404)
    return Response(content=clip, media_type="audio/wav")


@router.get("/filler/{cid}")
async def get_filler(cid: str):
    clip = filler_store.get(cid)
    if clip is None:
        return Response(status_code=404)
    return Response(content=clip, media_type="audio/wav")


async def synth_clip(text: str):
    clean = normalize_for_tts(text)
    if sarvam_ready():
        b64 = await sarvam_tts(clean, lang="gu-IN")
        if b64:
            return wav_base64_to_buffer(b64)
    if bhashini_ready():
        res = await bhashini_tts(text, lang=config.default_language, sampling_rate=8000)
        if res:
            return wav_base64_to_buffer(res["audioBase64"])
    return None


async def speak(vr, text):
    clip = await synth_clip(text)
    if clip is not None:
        cid = _next_id()
        audio_store[cid] = clip
        vr.play(f"{config.public_url}/voice/audio/{cid}")
        return
    vr.say(normalize_for_tts(text), language="gu-IN", voice="Google.gu-IN-Standard-A")


# ── Thinking fillers ─────────────────────────────────────────
FILLERS = ["હા, એક ક્ષણ...", "જરા જોઈ રહી છું...", "હમ્મ, એક સેકન્ડ...", "સારું, જોઉં છું..."]
_fillers_warmed = False


async def warm_fillers():
    global _fillers_warmed
    if _fillers_warmed or not sarvam_ready():
        return
    for i, txt in enumerate(FILLERS):
        clip = await synth_clip(txt)
        if clip is not None:
            filler_store[f"f{i}"] = clip
    _fillers_warmed = True


def random_filler_url():
    ids = list(filler_store.keys())
    if not ids:
        return None
    return f"{config.public_url}/voice/filler/{random.choice(ids)}"


# ── STT engine selection ─────────────────────────────────────
def stt_mode():
    return config.stt_engine == "sarvam" and sarvam_ready() and bool(config.twilio.account_sid)


SPEECH_HINTS = ("RK University, admission, B.Tech, BCA, MCA, BBA, MBA, B.Pharm, Pharm.D, BPT, "
                "Diploma, B.Sc, Agriculture, fees, placement, scholarship, hostel, eligibility, "
                "12th, 10th, Science, Commerce, હા, ના, રાજકોટ, અમદાવાદ, સુરત")


def listen(vr, session_id, empties=0):
    action = f"/voice/turn?sid={session_id}" + (f"&empties={empties}" if empties else "")
    if stt_mode():
        vr.record(action=action, method="POST", max_length=15, timeout=2,
                  play_beep=False, trim="trim-silence", finish_on_key="#")
        return
    vr.gather(input="speech", language="gu-IN", speech_model="phone_call",
              speech_timeout="auto", enhanced=True, hints=SPEECH_HINTS,
              action_on_empty_result=True, action=action, method="POST")


async def transcribe_recording(recording_url: str) -> str:
    url = f"{recording_url}.wav"
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(url, auth=(config.twilio.account_sid, config.twilio.auth_token))
                r.raise_for_status()
                text = await sarvam_stt(r.content, lang="gu-IN")
                return text or ""
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404 and attempt < 2:
                await asyncio.sleep(0.3)  # recording not ready yet
                continue
            print("[stt] recording fetch failed:", e.response.status_code)
            return ""
        except Exception as e:
            print("[stt] transcribe failed:", str(e))
            return ""
    return ""


# Bounded greeting: never let the opening webhook hang past Twilio's ~15s limit.
async def safe_greeting(session_id, direction, name=""):
    try:
        return await asyncio.wait_for(greet(session_id), timeout=8.0)
    except Exception as e:
        print("[greet] fallback:", type(e).__name__)
        if direction == "outbound":
            tail = (f"શું હું {name} સાથે વાત કરી રહ્યો છું?" if name
                    else "શું હું જાણી શકું કે હું કોની સાથે વાત કરી રહ્યો છું?")
            text = f"નમસ્તે! હું RK University ની admission સહાયક બોલું છું. {tail}"
        else:
            text = "નમસ્તે, RK University માં કોલ કરવા બદલ આભાર. હું આજે તમારી શું મદદ કરી શકું?"
        s = get_session(session_id)
        if s is not None:
            s["history"].append({"role": "assistant", "content": text})
        return text


# ── Call entry points ────────────────────────────────────────
@router.post("/inbound")
async def inbound(request: Request):
    form = await request.form()
    session_id = form.get("CallSid") or f"inbound-{int(time.time()*1000)}"
    vr = VoiceResponse()
    start_session(session_id, direction="inbound", phone=form.get("From", "") or "")
    await speak(vr, await safe_greeting(session_id, "inbound"))
    listen(vr, session_id)
    return _xml(vr)


@router.post("/outbound")
async def outbound(request: Request):
    form = await request.form()
    session_id = form.get("CallSid") or f"outbound-{int(time.time()*1000)}"
    student_name = request.query_params.get("name", "")
    vr = VoiceResponse()
    start_session(session_id, direction="outbound", student_name=student_name, phone=form.get("To", "") or "")
    await speak(vr, await safe_greeting(session_id, "outbound", student_name))
    listen(vr, session_id)
    return _xml(vr)


# ── Each conversational turn ─────────────────────────────────
# Return the filler immediately and run transcription + LLM + TTS as ONE
# background task, so all that work overlaps the filler audio. /answer plays the
# already-rendered clip. Only unavoidable wait is the record silence timeout.
@router.post("/turn")
async def turn(request: Request):
    form = await request.form()
    session_id = request.query_params.get("sid")
    empties = int(request.query_params.get("empties", "0"))
    vr = VoiceResponse()

    if stt_mode():
        recording_url = form.get("RecordingUrl", "") or ""

        async def job():
            try:
                t0 = time.time()
                speech = (await transcribe_recording(recording_url)).strip() if recording_url else ""
                t1 = time.time()
                if not speech:
                    return {"empty": True, "empties": empties}
                res = await handle_turn(session_id, speech)
                t2 = time.time()
                clip = await synth_clip(res["reply"])
                clip_id = None
                if clip is not None:
                    clip_id = _next_id()
                    audio_store[clip_id] = clip
                print(f'[turn] heard: "{speech}" | stt {int((t1-t0)*1000)}ms · '
                      f"llm {int((t2-t1)*1000)}ms · tts {int((time.time()-t2)*1000)}ms")
                return {"reply": res["reply"], "endCall": res["endCall"], "clipId": clip_id}
            except Exception as e:
                print("[turn]", str(e))
                return {"reply": "માફ કરશો, ફરી કહેશો?", "endCall": False}

        pending_turns[session_id] = asyncio.create_task(job())
        filler_url = random_filler_url()
        if filler_url:
            vr.play(filler_url)
        vr.redirect(f"/voice/answer?sid={session_id}", method="POST")
        return _xml(vr)

    # ── Twilio Gather fallback (no Sarvam STT) ──
    speech = (form.get("SpeechResult", "") or "").strip()
    if not speech:
        n = empties + 1
        if n >= 3:
            await speak(vr, "લાગે છે અત્યારે વાત થઈ શકતી નથી. અમારી admission ટીમ ફરી સંપર્ક કરશે. આભાર!")
            end_session(session_id)
            vr.hangup()
            return _xml(vr)
        await speak(vr, "માફ કરશો, મને બરાબર સંભળાયું નહીં. ફરી એકવાર કહેશો?")
        listen(vr, session_id, n)
        return _xml(vr)

    async def gjob():
        try:
            return await handle_turn(session_id, speech)
        except Exception:
            return {"reply": "માફ કરશો, ફરી કહેશો?", "endCall": False}

    pending_turns[session_id] = asyncio.create_task(gjob())
    filler_url = random_filler_url()
    if filler_url:
        vr.play(filler_url)
        vr.redirect(f"/voice/answer?sid={session_id}", method="POST")
        return _xml(vr)
    r = await pending_turns.pop(session_id)
    await speak(vr, r["reply"])
    (end_session(session_id), vr.hangup()) if r.get("endCall") else listen(vr, session_id)
    return _xml(vr)


# ── Deliver the reply after the filler clip has played ───────
@router.post("/answer")
async def answer(request: Request):
    session_id = request.query_params.get("sid")
    vr = VoiceResponse()
    task = pending_turns.pop(session_id, None)
    r = await task if task else {"reply": "માફ કરશો, ફરી કહેશો?", "endCall": False}

    if r.get("empty"):
        n = (r.get("empties") or 0) + 1
        if n >= 3:
            await speak(vr, "લાગે છે અત્યારે વાત થઈ શકતી નથી. અમારી admission ટીમ ફરી સંપર્ક કરશે. આભાર!")
            end_session(session_id)
            vr.hangup()
            return _xml(vr)
        await speak(vr, "માફ કરશો, મને બરાબર સંભળાયું નહીં. ફરી એકવાર કહેશો?")
        listen(vr, session_id, n)
        return _xml(vr)

    if r.get("clipId"):
        vr.play(f"{config.public_url}/voice/audio/{r['clipId']}")
    else:
        await speak(vr, r["reply"])

    if r.get("endCall"):
        end_session(session_id)
        vr.hangup()
    else:
        listen(vr, session_id)
    return _xml(vr)
