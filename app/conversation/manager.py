"""Per-call dialogue state + lead capture + live events (ported from manager.js)."""
import asyncio
import re
import time

from ..llm.assistant import reply as assistant_reply
from ..data.leads import save_lead, EMPTY_LEAD

_sessions = {}
_subscribers = set()  # set[asyncio.Queue] for the live SSE monitor


def _emit(event, snap):
    for q in list(_subscribers):
        try:
            q.put_nowait((event, snap))
        except Exception:
            pass


def subscribe() -> "asyncio.Queue":
    q = asyncio.Queue()
    _subscribers.add(q)
    return q


def unsubscribe(q):
    _subscribers.discard(q)


def _snapshot(s):
    return {
        "id": s["id"],
        "direction": s["direction"],
        "studentName": s.get("studentName") or s["lead"].get("student_name") or "",
        "phone": s.get("phone") or s["lead"].get("mobile_number") or "",
        "lead": s["lead"],
        "turns": len(s["history"]),
        "lastMessage": s["history"][-1] if s["history"] else None,
        "transcript": s["history"],
        "startedAt": s["startedAt"],
    }


def list_active_sessions():
    return [_snapshot(s) for s in _sessions.values()]


def start_session(session_id, direction="inbound", student_name="", phone=""):
    session = {
        "id": session_id,
        "direction": direction,
        "studentName": student_name,
        "phone": phone,
        "history": [],
        "lead": {**EMPTY_LEAD, "student_name": student_name, "mobile_number": phone or ""},
        "callback": None,
        "startedAt": int(time.time() * 1000),
    }
    _sessions[session_id] = session
    _emit("started", _snapshot(session))
    return session


def get_session(session_id):
    return _sessions.get(session_id)


async def greet(session_id):
    s = _sessions.get(session_id) or start_session(session_id)
    res = await assistant_reply([], {"direction": s["direction"], "studentName": s["studentName"], "lead": s["lead"]})
    s["history"].append({"role": "assistant", "content": res["reply"]})
    _emit("turn", _snapshot(s))
    return res["reply"]


async def handle_turn(session_id, user_text):
    s = _sessions.get(session_id) or start_session(session_id)
    s["history"].append({"role": "user", "content": user_text})

    res = await assistant_reply(s["history"], {
        "direction": s["direction"], "studentName": s["studentName"], "lead": s["lead"],
    })
    s["history"].append({"role": "assistant", "content": res["reply"]})
    if res.get("leadUpdates"):
        s["lead"] = {**s["lead"], **res["leadUpdates"]}

    if re.search(r"(\d{1,2})\s*(વાગ્યે|am|pm|baje|o'?clock)", user_text, re.I):
        s["callback"] = user_text

    save_lead(session_id, s["lead"], {
        "direction": s["direction"], "callback": s["callback"], "transcript": s["history"],
    })
    _emit("turn", _snapshot(s))
    return {"reply": res["reply"], "lead": s["lead"], "endCall": res.get("endCall", False)}


def end_session(session_id):
    s = _sessions.get(session_id)
    if s:
        save_lead(session_id, s["lead"], {
            "direction": s["direction"], "callback": s["callback"],
            "transcript": s["history"], "ended": True,
        })
        _emit("ended", _snapshot(s))
        _sessions.pop(session_id, None)
