import twilio from "twilio";
import config from "../config.js";

// ─────────────────────────────────────────────────────────────
// Place an outbound admission call. Shared by the CLI script and
// the admin dialer / campaign runner.
// Returns the Twilio Call SID.
// ─────────────────────────────────────────────────────────────
export function twilioReady() {
  return Boolean(config.twilio.accountSid && config.twilio.authToken && config.publicUrl);
}

export async function placeCall(to, name = "") {
  if (!to) throw new Error("Destination number is required.");
  if (!twilioReady()) {
    throw new Error("Set TWILIO_* credentials and PUBLIC_URL in .env to place calls.");
  }
  const client = twilio(config.twilio.accountSid, config.twilio.authToken);
  const url = `${config.publicUrl}/voice/outbound?name=${encodeURIComponent(name)}`;
  const call = await client.calls.create({
    to,
    from: config.twilio.phoneNumber,
    url,
    method: "POST",
  });
  return call.sid;
}
