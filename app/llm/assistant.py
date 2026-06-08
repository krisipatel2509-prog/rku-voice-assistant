"""Admission knowledge assistant — LLM dispatch (ported from src/llm/assistant.js).

reply(history, ctx) -> {"reply", "leadUpdates", "endCall"}
Providers: anthropic | openai-compatible | mock (offline, KB-driven).
"""
import json
import re

import httpx

from ..config import config
from .prompt import system_prompt
from .mock import mock_reply


def _parse_model_json(text):
    if not text:
        return None
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        return {"reply": text.strip(), "lead_updates": {}, "end_call": False}
    try:
        return json.loads(m.group(0))
    except Exception:
        return {"reply": text.strip(), "lead_updates": {}, "end_call": False}


async def _anthropic_reply(sys, history):
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            json={
                "model": config.llm.model,
                "max_tokens": 160,
                "system": sys,
                "messages": [{"role": m["role"], "content": m["content"]} for m in history],
            },
            headers={
                "x-api-key": config.llm.api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
        )
        r.raise_for_status()
        data = r.json()
        content = data.get("content") or [{}]
        return content[0].get("text", "")


async def _openai_reply(sys, history):
    base = (config.llm.base_url or "https://api.openai.com/v1").rstrip("/")
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(
            f"{base}/chat/completions",
            json={
                "model": config.llm.model,
                "max_tokens": 160,
                "temperature": 0.6,
                "messages": [{"role": "system", "content": sys}, *history],
            },
            headers={"Authorization": f"Bearer {config.llm.api_key}", "Content-Type": "application/json"},
        )
        r.raise_for_status()
        data = r.json()
        return (data.get("choices") or [{}])[0].get("message", {}).get("content", "")


async def reply(history, ctx=None):
    ctx = ctx or {}
    provider = config.llm.provider

    if provider == "mock" or not config.llm.api_key:
        return mock_reply(history, ctx)

    sys = system_prompt(ctx.get("direction", "inbound"), ctx.get("studentName", ""))
    try:
        if provider == "anthropic":
            raw = await _anthropic_reply(sys, history)
        else:
            raw = await _openai_reply(sys, history)
        parsed = _parse_model_json(raw) or {}
        return {
            "reply": parsed.get("reply") or "માફ કરશો, ફરી એકવાર કહેશો?",
            "leadUpdates": parsed.get("lead_updates") or {},
            "endCall": bool(parsed.get("end_call")),
        }
    except Exception as e:
        print("[llm] provider error, falling back to mock:", str(e))
        return mock_reply(history, ctx)
