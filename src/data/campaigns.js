import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "..", "..", "campaigns.json");

// ─────────────────────────────────────────────────────────────
// Outbound campaigns: a named list of {name, phone} recipients
// that the dialer can run in bulk. Persisted to campaigns.json.
// ─────────────────────────────────────────────────────────────

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeAll(rows) {
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2));
}

export function listCampaigns() {
  return readAll();
}

export function getCampaign(id) {
  return readAll().find((c) => c.id === id) || null;
}

export function createCampaign({ name, recipients = [] }) {
  const rows = readAll();
  const campaign = {
    id: crypto.randomUUID(),
    name: name || "Untitled campaign",
    recipients: recipients
      .map((r) => ({ name: r.name || "", phone: (r.phone || "").trim() }))
      .filter((r) => r.phone),
    status: "draft",
    results: [],
    createdAt: new Date().toISOString(),
  };
  rows.unshift(campaign);
  writeAll(rows);
  return campaign;
}

export function updateCampaign(id, patch) {
  const rows = readAll();
  const idx = rows.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  rows[idx] = { ...rows[idx], ...patch, updatedAt: new Date().toISOString() };
  writeAll(rows);
  return rows[idx];
}

export function deleteCampaign(id) {
  const rows = readAll().filter((c) => c.id !== id);
  writeAll(rows);
}
