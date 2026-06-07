// Trigger an outbound admission call.
//   node scripts/outbound-call.js +9198XXXXXXXX "Student Name"
import { placeCall } from "../src/twilio/outbound.js";

const to = process.argv[2];
const name = process.argv[3] || "";

if (!to) {
  console.error('Usage: node scripts/outbound-call.js <+E164 number> ["Student Name"]');
  process.exit(1);
}

try {
  const sid = await placeCall(to, name);
  console.log(`Calling ${to} (${name || "unknown"}) — Call SID: ${sid}`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
