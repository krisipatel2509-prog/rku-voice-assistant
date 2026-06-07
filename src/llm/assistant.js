import axios from "axios";
import config from "../config.js";
import { systemPrompt } from "./prompt.js";
import { mockReply } from "./mock.js";

// ─────────────────────────────────────────────────────────────
// Admission Knowledge Assistant.
// reply(history, context) -> { reply, leadUpdates, endCall }
//
// history: [{ role: "user"|"assistant", content: string }, ...]
// Providers: anthropic | openai-compatible | mock (offline, KB-driven).
// ─────────────────────────────────────────────────────────────

function parseModelJson(text) {
  if (!text) return null;
  // Strip code fences / surrounding prose and grab the first {...} block.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { reply: text.trim(), lead_updates: {}, end_call: false };
  try {
    return JSON.parse(match[0]);
  } catch {
    return { reply: text.trim(), lead_updates: {}, end_call: false };
  }
}

async function anthropicReply(sys, history) {
  const { data } = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: config.llm.model,
      max_tokens: 160,
      system: sys,
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    },
    {
      headers: {
        "x-api-key": config.llm.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      timeout: 15000,
    }
  );
  return data?.content?.[0]?.text || "";
}

async function openaiReply(sys, history) {
  const base = config.llm.baseUrl || "https://api.openai.com/v1";
  const { data } = await axios.post(
    `${base.replace(/\/$/, "")}/chat/completions`,
    {
      model: config.llm.model,
      max_tokens: 160,
      temperature: 0.6,
      messages: [{ role: "system", content: sys }, ...history],
    },
    {
      headers: {
        Authorization: `Bearer ${config.llm.apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    }
  );
  return data?.choices?.[0]?.message?.content || "";
}

export async function reply(history, ctx = {}) {
  const provider = config.llm.provider;

  // Offline / no-key path: rule-based KB assistant (keeps the demo working).
  if (provider === "mock" || !config.llm.apiKey) {
    return mockReply(history, ctx);
  }

  const sys = systemPrompt(ctx);
  try {
    let raw = "";
    if (provider === "anthropic") raw = await anthropicReply(sys, history);
    else raw = await openaiReply(sys, history);

    const parsed = parseModelJson(raw) || {};
    return {
      reply: parsed.reply || "માફ કરશો, ફરી એકવાર કહેશો?",
      leadUpdates: parsed.lead_updates || {},
      endCall: Boolean(parsed.end_call),
    };
  } catch (err) {
    console.error("[llm] provider error, falling back to mock:", err.message);
    return mockReply(history, ctx);
  }
}
