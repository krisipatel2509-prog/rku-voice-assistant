import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEADS_FILE = path.join(__dirname, "..", "..", "leads.json");

export const EMPTY_LEAD = {
  student_name: "",
  admission_intent: "",
  mobile_number: "",
  city: "",
  course_interest: "",
  qualification: "",
  passing_year: "",
  percentage: "",
  preferred_language: "Gujarati",
};

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(LEADS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeAll(rows) {
  fs.writeFileSync(LEADS_FILE, JSON.stringify(rows, null, 2));
}

// Upsert a lead by session id. `meta` may include direction, callback, etc.
export function saveLead(sessionId, lead, meta = {}) {
  const rows = readAll();
  const idx = rows.findIndex((r) => r.sessionId === sessionId);
  const record = {
    sessionId,
    ...EMPTY_LEAD,
    ...(idx >= 0 ? rows[idx] : {}),
    ...lead,
    ...meta,
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) rows[idx] = record;
  else rows.unshift(record);
  writeAll(rows);
  return record;
}

export function listLeads() {
  return readAll();
}
