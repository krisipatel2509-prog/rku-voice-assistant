"""Admin panel API (ported from src/api/admin.js). Same endpoints the React app calls."""
import asyncio
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse

from .config import config
from .auth import login as do_login, require_auth
from .data.leads import list_leads
from .data.campaigns import (list_campaigns, get_campaign, create_campaign,
                             update_campaign, delete_campaign)
from .twilio_outbound import place_call, twilio_ready
from .conversation.manager import list_active_sessions, subscribe, unsubscribe

router = APIRouter(prefix="/api/admin")

REQUIRED_FIELDS = ["student_name", "mobile_number", "course_interest"]


def _is_qualified(l):
    return all((l.get(f) or "").strip() for f in REQUIRED_FIELDS)


def _day_key(iso):
    return (iso or "")[:10]


def _today():
    return datetime.now(timezone.utc).date().isoformat()


# ── Auth ─────────────────────────────────────────────────────
@router.post("/auth/login")
async def auth_login(request: Request):
    body = await request.json()
    token = do_login(body.get("user"), body.get("password"))
    if not token:
        return JSONResponse({"error": "Invalid credentials"}, status_code=401)
    return {"token": token, "user": body.get("user")}


@router.get("/me")
async def me(admin=Depends(require_auth)):
    return {"user": admin["user"]}


# ── Dashboard stats ──────────────────────────────────────────
@router.get("/stats")
async def stats(admin=Depends(require_auth)):
    leads = list_leads()
    today_key = _today()
    qualified = sum(1 for l in leads if _is_qualified(l))
    return {
        "totalLeads": len(leads),
        "qualifiedLeads": qualified,
        "conversionRate": round(qualified / len(leads) * 100) if leads else 0,
        "callsToday": sum(1 for l in leads if _day_key(l.get("updatedAt")) == today_key),
        "inbound": sum(1 for l in leads if l.get("direction") == "inbound"),
        "outbound": sum(1 for l in leads if l.get("direction") == "outbound"),
        "activeCalls": len(list_active_sessions()),
        "recent": leads[:8],
    }


# ── Analytics ────────────────────────────────────────────────
@router.get("/analytics")
async def analytics(admin=Depends(require_auth)):
    leads = list_leads()

    base = datetime.now(timezone.utc)
    days = [(base - timedelta(days=i)).date().isoformat() for i in range(13, -1, -1)]
    by_day = {d: 0 for d in days}
    for l in leads:
        k = _day_key(l.get("updatedAt"))
        if k in by_day:
            by_day[k] += 1
    leads_by_day = [{"date": d, "count": by_day[d]} for d in days]

    course_map = {}
    for l in leads:
        c = (l.get("course_interest") or "Unknown").strip() or "Unknown"
        course_map[c] = course_map.get(c, 0) + 1
    course_breakdown = sorted(
        [{"course": c, "count": n} for c, n in course_map.items()],
        key=lambda x: x["count"], reverse=True)

    city_map = {}
    for l in leads:
        c = (l.get("city") or "Unknown").strip() or "Unknown"
        city_map[c] = city_map.get(c, 0) + 1
    city_breakdown = sorted(
        [{"city": c, "count": n} for c, n in city_map.items()],
        key=lambda x: x["count"], reverse=True)[:8]

    return {
        "leadsByDay": leads_by_day,
        "courseBreakdown": course_breakdown,
        "cityBreakdown": city_breakdown,
        "directionSplit": [
            {"name": "Inbound", "value": sum(1 for l in leads if l.get("direction") == "inbound")},
            {"name": "Outbound", "value": sum(1 for l in leads if l.get("direction") == "outbound")},
        ],
    }


# ── Leads ────────────────────────────────────────────────────
@router.get("/leads")
async def leads(admin=Depends(require_auth)):
    return list_leads()


# ── Dialer ───────────────────────────────────────────────────
@router.post("/call")
async def call(request: Request, admin=Depends(require_auth)):
    body = await request.json()
    phone = body.get("phone")
    if not phone:
        return JSONResponse({"error": "phone is required"}, status_code=400)
    try:
        sid = await place_call(phone, body.get("name", ""))
        return {"ok": True, "sid": sid}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)


@router.get("/dialer/status")
async def dialer_status(admin=Depends(require_auth)):
    return {"twilioReady": twilio_ready(), "from": config.twilio.phone_number}


# ── Campaigns ────────────────────────────────────────────────
@router.get("/campaigns")
async def campaigns(admin=Depends(require_auth)):
    return list_campaigns()


@router.post("/campaigns")
async def campaign_create(request: Request, admin=Depends(require_auth)):
    body = await request.json()
    return create_campaign(body.get("name"), body.get("recipients"))


@router.delete("/campaigns/{cid}")
async def campaign_delete(cid: str, admin=Depends(require_auth)):
    delete_campaign(cid)
    return {"ok": True}


@router.post("/campaigns/{cid}/run")
async def campaign_run(cid: str, admin=Depends(require_auth)):
    campaign = get_campaign(cid)
    if not campaign:
        return JSONResponse({"error": "not found"}, status_code=404)
    if not twilio_ready():
        return JSONResponse({"error": "Twilio + PUBLIC_URL not configured."}, status_code=400)

    results = []
    for r in campaign["recipients"]:
        try:
            sid = await place_call(r["phone"], r.get("name", ""))
            results.append({"phone": r["phone"], "name": r.get("name", ""), "ok": True, "sid": sid})
        except Exception as e:
            results.append({"phone": r["phone"], "name": r.get("name", ""), "ok": False, "error": str(e)})
    return update_campaign(campaign["id"], {
        "status": "completed", "results": results,
        "ranAt": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
    })


# ── Live call monitor (Server-Sent Events) ───────────────────
@router.get("/live")
async def live(request: Request, admin=Depends(require_auth)):
    async def event_stream():
        q = subscribe()
        try:
            snap = {"sessions": list_active_sessions()}
            yield f"event: snapshot\ndata: {json.dumps(snap)}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event, data = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield f"event: {event}\ndata: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            unsubscribe(q)

    return StreamingResponse(event_stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "Connection": "keep-alive"})
