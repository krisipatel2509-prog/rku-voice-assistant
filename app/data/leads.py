"""Lead persistence to leads.json (ported from src/data/leads.js).

Reuses the SAME leads.json at the repo root so existing data carries over.
"""
import json
import os
from datetime import datetime, timezone

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# DATA_DIR lets you point persistence at a mounted disk (e.g. a Render Disk).
_DATA_DIR = os.environ.get("DATA_DIR") or _ROOT
LEADS_FILE = os.path.join(_DATA_DIR, "leads.json")

EMPTY_LEAD = {
    "student_name": "",
    "admission_intent": "",
    "mobile_number": "",
    "city": "",
    "course_interest": "",
    "qualification": "",
    "passing_year": "",
    "percentage": "",
    "preferred_language": "Gujarati",
}


def _read_all():
    try:
        with open(LEADS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _write_all(rows):
    with open(LEADS_FILE, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)


def _now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def save_lead(session_id, lead, meta=None):
    meta = meta or {}
    rows = _read_all()
    idx = next((i for i, r in enumerate(rows) if r.get("sessionId") == session_id), -1)
    base = rows[idx] if idx >= 0 else {}
    record = {"sessionId": session_id, **EMPTY_LEAD, **base, **lead, **meta, "updatedAt": _now_iso()}
    if idx >= 0:
        rows[idx] = record
    else:
        rows.insert(0, record)
    _write_all(rows)
    return record


def list_leads():
    return _read_all()
