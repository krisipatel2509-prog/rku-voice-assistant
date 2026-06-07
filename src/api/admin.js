import express from "express";
import config from "../config.js";
import { login, requireAuth } from "./auth.js";
import { listLeads } from "../data/leads.js";
import { listActiveSessions, callEvents } from "../conversation/manager.js";
import { placeCall, twilioReady } from "../twilio/outbound.js";
import {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
} from "../data/campaigns.js";

export const router = express.Router();

// ── Auth ─────────────────────────────────────────────────────
router.post("/auth/login", (req, res) => {
  const { user, password } = req.body || {};
  const token = login(user, password);
  if (!token) return res.status(401).json({ error: "Invalid credentials" });
  res.json({ token, user });
});

// Everything below requires a valid token.
router.use(requireAuth);

router.get("/me", (req, res) => res.json({ user: req.admin.user }));

// ── Helpers ──────────────────────────────────────────────────
const REQUIRED_FIELDS = ["student_name", "mobile_number", "course_interest"];
const isQualified = (l) => REQUIRED_FIELDS.every((f) => (l[f] || "").trim());
const dayKey = (iso) => (iso || "").slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

// ── Dashboard stats ──────────────────────────────────────────
router.get("/stats", (_req, res) => {
  const leads = listLeads();
  const todayKey = today();
  const qualified = leads.filter(isQualified).length;
  res.json({
    totalLeads: leads.length,
    qualifiedLeads: qualified,
    conversionRate: leads.length ? Math.round((qualified / leads.length) * 100) : 0,
    callsToday: leads.filter((l) => dayKey(l.updatedAt) === todayKey).length,
    inbound: leads.filter((l) => l.direction === "inbound").length,
    outbound: leads.filter((l) => l.direction === "outbound").length,
    activeCalls: listActiveSessions().length,
    recent: leads.slice(0, 8),
  });
});

// ── Analytics ────────────────────────────────────────────────
router.get("/analytics", (_req, res) => {
  const leads = listLeads();

  // Leads per day, last 14 days.
  const days = [];
  const base = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const byDay = Object.fromEntries(days.map((d) => [d, 0]));
  for (const l of leads) {
    const k = dayKey(l.updatedAt);
    if (k in byDay) byDay[k]++;
  }
  const leadsByDay = days.map((d) => ({ date: d, count: byDay[d] }));

  // Course interest breakdown.
  const courseMap = {};
  for (const l of leads) {
    const c = (l.course_interest || "Unknown").trim() || "Unknown";
    courseMap[c] = (courseMap[c] || 0) + 1;
  }
  const courseBreakdown = Object.entries(courseMap)
    .map(([course, count]) => ({ course, count }))
    .sort((a, b) => b.count - a.count);

  // City breakdown (top 8).
  const cityMap = {};
  for (const l of leads) {
    const c = (l.city || "Unknown").trim() || "Unknown";
    cityMap[c] = (cityMap[c] || 0) + 1;
  }
  const cityBreakdown = Object.entries(cityMap)
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  res.json({
    leadsByDay,
    courseBreakdown,
    cityBreakdown,
    directionSplit: [
      { name: "Inbound", value: leads.filter((l) => l.direction === "inbound").length },
      { name: "Outbound", value: leads.filter((l) => l.direction === "outbound").length },
    ],
  });
});

// ── Leads ────────────────────────────────────────────────────
router.get("/leads", (_req, res) => res.json(listLeads()));

// ── Dialer: place a single outbound call ─────────────────────
router.post("/call", async (req, res) => {
  const { phone, name = "" } = req.body || {};
  if (!phone) return res.status(400).json({ error: "phone is required" });
  try {
    const sid = await placeCall(phone, name);
    res.json({ ok: true, sid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/dialer/status", (_req, res) =>
  res.json({ twilioReady: twilioReady(), from: config.twilio.phoneNumber })
);

// ── Campaigns ────────────────────────────────────────────────
router.get("/campaigns", (_req, res) => res.json(listCampaigns()));

router.post("/campaigns", (req, res) => {
  const { name, recipients } = req.body || {};
  res.json(createCampaign({ name, recipients }));
});

router.delete("/campaigns/:id", (req, res) => {
  deleteCampaign(req.params.id);
  res.json({ ok: true });
});

// Run a campaign: dial every recipient, collect per-call results.
router.post("/campaigns/:id/run", async (req, res) => {
  const campaign = getCampaign(req.params.id);
  if (!campaign) return res.status(404).json({ error: "not found" });
  if (!twilioReady()) {
    return res.status(400).json({ error: "Twilio + PUBLIC_URL not configured." });
  }

  const results = [];
  for (const r of campaign.recipients) {
    try {
      const sid = await placeCall(r.phone, r.name);
      results.push({ phone: r.phone, name: r.name, ok: true, sid });
    } catch (err) {
      results.push({ phone: r.phone, name: r.name, ok: false, error: err.message });
    }
  }
  const updated = updateCampaign(campaign.id, {
    status: "completed",
    results,
    ranAt: new Date().toISOString(),
  });
  res.json(updated);
});

// ── Live call monitor (Server-Sent Events) ───────────────────
router.get("/live", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Initial snapshot of any in-flight calls.
  send("snapshot", { sessions: listActiveSessions() });

  const onStarted = (s) => send("started", s);
  const onTurn = (s) => send("turn", s);
  const onEnded = (s) => send("ended", s);
  callEvents.on("started", onStarted);
  callEvents.on("turn", onTurn);
  callEvents.on("ended", onEnded);

  const heartbeat = setInterval(() => res.write(": ping\n\n"), 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    callEvents.off("started", onStarted);
    callEvents.off("turn", onTurn);
    callEvents.off("ended", onEnded);
  });
});
