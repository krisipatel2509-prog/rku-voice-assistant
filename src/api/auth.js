import crypto from "crypto";
import config from "../config.js";

// ─────────────────────────────────────────────────────────────
// Minimal demo auth: verify .env credentials, issue a signed
// token, and gate admin routes. No DB, no external deps.
// Token = base64url(payload).hmac — stateless, expires in 12h.
// ─────────────────────────────────────────────────────────────

const SECRET = config.admin.password + "::rku-admin-secret";
const TTL_MS = 12 * 60 * 60 * 1000;

function sign(payloadB64) {
  return crypto.createHmac("sha256", SECRET).update(payloadB64).digest("base64url");
}

export function login(user, password) {
  if (user !== config.admin.user || password !== config.admin.password) {
    return null;
  }
  const payload = { user, exp: Date.now() + TTL_MS };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verify(token) {
  if (!token) return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig || sign(payloadB64) !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// Express middleware — requires a valid Bearer token.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : req.query.token;
  const payload = verify(token);
  if (!payload) return res.status(401).json({ error: "unauthorized" });
  req.admin = payload;
  next();
}
