"""Outbound campaign storage (ported from src/data/campaigns.js)."""
import json
import os
import uuid
from datetime import datetime, timezone

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_DATA_DIR = os.environ.get("DATA_DIR") or _ROOT
FILE = os.path.join(_DATA_DIR, "campaigns.json")


def _now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _read_all():
    try:
        with open(FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _write_all(rows):
    with open(FILE, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)


def list_campaigns():
    return _read_all()


def get_campaign(cid):
    return next((c for c in _read_all() if c.get("id") == cid), None)


def create_campaign(name=None, recipients=None):
    rows = _read_all()
    recipients = recipients or []
    campaign = {
        "id": str(uuid.uuid4()),
        "name": name or "Untitled campaign",
        "recipients": [
            {"name": r.get("name", ""), "phone": (r.get("phone", "") or "").strip()}
            for r in recipients if (r.get("phone", "") or "").strip()
        ],
        "status": "draft",
        "results": [],
        "createdAt": _now_iso(),
    }
    rows.insert(0, campaign)
    _write_all(rows)
    return campaign


def update_campaign(cid, patch):
    rows = _read_all()
    idx = next((i for i, c in enumerate(rows) if c.get("id") == cid), -1)
    if idx < 0:
        return None
    rows[idx] = {**rows[idx], **patch, "updatedAt": _now_iso()}
    _write_all(rows)
    return rows[idx]


def delete_campaign(cid):
    _write_all([c for c in _read_all() if c.get("id") != cid])
