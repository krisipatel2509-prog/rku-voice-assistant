"""Minimal stateless demo auth (ported from src/api/auth.js).

Token = base64url(payload).hmac — HMAC-SHA256, 12h expiry.
"""
import base64
import hashlib
import hmac
import json
import time

from fastapi import Header, Query, HTTPException

from .config import config

_SECRET = (config.admin.password + "::rku-admin-secret").encode()
_TTL_MS = 12 * 60 * 60 * 1000


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _sign(payload_b64: str) -> str:
    return _b64url_encode(hmac.new(_SECRET, payload_b64.encode(), hashlib.sha256).digest())


def login(user: str, password: str):
    if user != config.admin.user or password != config.admin.password:
        return None
    payload = {"user": user, "exp": int(time.time() * 1000) + _TTL_MS}
    payload_b64 = _b64url_encode(json.dumps(payload).encode())
    return f"{payload_b64}.{_sign(payload_b64)}"


def verify(token: str):
    if not token or "." not in token:
        return None
    payload_b64, _, sig = token.partition(".")
    if not payload_b64 or not sig or not hmac.compare_digest(_sign(payload_b64), sig):
        return None
    try:
        payload = json.loads(_b64url_decode(payload_b64))
        if payload.get("exp", 0) < int(time.time() * 1000):
            return None
        return payload
    except Exception:
        return None


def require_auth(authorization: str = Header(default=""), token: str = Query(default="")):
    bearer = authorization[7:] if authorization.startswith("Bearer ") else token
    payload = verify(bearer)
    if not payload:
        raise HTTPException(status_code=401, detail="unauthorized")
    return payload
