import { EventEmitter } from "events";
import { reply as assistantReply } from "../llm/assistant.js";
import { saveLead, EMPTY_LEAD } from "../data/leads.js";

// ─────────────────────────────────────────────────────────────
// Holds per-call dialogue state and orchestrates a turn:
//   user text -> assistant -> reply + lead updates -> persist.
// Sessions live in memory keyed by call/stream id.
//
// `callEvents` broadcasts live activity to the admin monitor:
//   "started" | "turn" | "ended", each with a session snapshot.
// ─────────────────────────────────────────────────────────────

const sessions = new Map();
export const callEvents = new EventEmitter();
callEvents.setMaxListeners(50);

// A trimmed, serialisable view of a session for the live monitor.
function snapshot(s) {
  return {
    id: s.id,
    direction: s.direction,
    studentName: s.studentName || s.lead.student_name || "",
    phone: s.phone || s.lead.mobile_number || "",
    lead: s.lead,
    turns: s.history.length,
    lastMessage: s.history[s.history.length - 1] || null,
    transcript: s.history,
    startedAt: s.startedAt,
  };
}

export function listActiveSessions() {
  return [...sessions.values()].map(snapshot);
}

export function startSession(sessionId, { direction = "inbound", studentName = "", phone = "" } = {}) {
  const session = {
    id: sessionId,
    direction,
    studentName,
    phone,
    history: [],
    lead: { ...EMPTY_LEAD, student_name: studentName, mobile_number: phone || "" },
    callback: null,
    startedAt: Date.now(),
  };
  sessions.set(sessionId, session);
  callEvents.emit("started", snapshot(session));
  return session;
}

export function getSession(sessionId) {
  return sessions.get(sessionId);
}

// Produce the opening line without any user input (greeting).
export async function greet(sessionId) {
  const s = sessions.get(sessionId) || startSession(sessionId);
  const { reply } = await assistantReply([], { direction: s.direction, studentName: s.studentName, lead: s.lead });
  s.history.push({ role: "assistant", content: reply });
  callEvents.emit("turn", snapshot(s));
  return reply;
}

// Process one user utterance and return the assistant's spoken reply.
export async function handleTurn(sessionId, userText) {
  const s = sessions.get(sessionId) || startSession(sessionId);
  s.history.push({ role: "user", content: userText });

  const { reply, leadUpdates, endCall } = await assistantReply(s.history, {
    direction: s.direction,
    studentName: s.studentName,
    lead: s.lead,
  });

  s.history.push({ role: "assistant", content: reply });
  if (leadUpdates && Object.keys(leadUpdates).length) {
    s.lead = { ...s.lead, ...leadUpdates };
  }

  // Capture a callback time mentioned on busy outbound calls.
  const cbMatch = userText.match(/(\d{1,2})\s*(વાગ્યે|am|pm|baje|o'?clock)/i);
  if (cbMatch) s.callback = userText;

  // Persist after every turn so a dropped call still leaves a lead.
  saveLead(sessionId, s.lead, {
    direction: s.direction,
    callback: s.callback,
    transcript: s.history,
  });

  callEvents.emit("turn", snapshot(s));
  return { reply, lead: s.lead, endCall };
}

export function endSession(sessionId) {
  const s = sessions.get(sessionId);
  if (s) {
    saveLead(sessionId, s.lead, { direction: s.direction, callback: s.callback, transcript: s.history, ended: true });
    callEvents.emit("ended", snapshot(s));
    sessions.delete(sessionId);
  }
}
