import { courses, facts, findCourse, university } from "../data/courses.js";

// ─────────────────────────────────────────────────────────────
// Offline, rule-based admission counselor (Gujarati).
// Drives the same behaviour as the LLM path — answers course
// queries from the KB and collects lead fields one at a time —
// so the demo works with zero API keys.
// ─────────────────────────────────────────────────────────────

const GUJARAT_CITIES = [
  "રાજકોટ", "અમદાવાદ", "સુરત", "વડોદરા", "ભાવનગર", "જામનગર", "જૂનાગઢ",
  "ગાંધીનગર", "આણંદ", "મોરબી", "ગોંડલ", "મહેસાણા", "rajkot", "ahmedabad",
  "surat", "vadodara", "bhavnagar", "jamnagar", "junagadh",
];

// Pull any lead fields present in the user's latest utterance.
function extractLead(text, lead) {
  const updates = {};
  const t = text || "";

  if (!lead.mobile_number) {
    const m = t.replace(/\s|-/g, "").match(/\b([6-9]\d{9})\b/);
    if (m) updates.mobile_number = m[1];
  }
  if (!lead.percentage) {
    // With a "%"/"ટકા" marker, or a bare 1–2 digit number (a year is 4 digits,
    // a phone is 10, so a short number answering the percentage prompt is safe).
    const p =
      t.match(/(\d{1,3}(?:\.\d+)?)\s*(?:%|ટકા|percent|percentage|cgpa|સીજીપીએ)/i) ||
      t.trim().match(/^(\d{1,2}(?:\.\d+)?|100)$/);
    if (p) updates.percentage = p[1];
  }
  if (!lead.passing_year) {
    const y = t.match(/\b(20\d{2}|19\d{2})\b/);
    if (y) updates.passing_year = y[1];
  }
  if (!lead.city) {
    const city = GUJARAT_CITIES.find((c) => t.toLowerCase().includes(c.toLowerCase()));
    if (city) updates.city = city;
  }
  if (!lead.course_interest) {
    const c = findCourse(t);
    if (c) updates.course_interest = c.name;
  }
  if (!lead.qualification) {
    if (/12\s*(th|મું)?|બારમ|hsc|science|commerce|arts|graduat|સ્નાતક|ગ્રેજ્યુએ/i.test(t))
      updates.qualification = t.match(/graduat|સ્નાતક|ગ્રેજ્યુએ/i) ? "Graduate" : "12th";
    else if (/10\s*(th|મું)?|દસમ|ssc/i.test(t)) updates.qualification = "10th";
  }
  if (!lead.student_name) {
    const nm = t.match(/(?:મારું નામ|નામ છે|હું)\s+([અ-હ઀-૿a-zA-Z]{2,20})/);
    if (nm) updates.student_name = nm[1];
    else {
      // Bare name: a short letters-only reply, no digits, not a course or a
      // greeting / yes-no / query keyword. Prevents looping on the name prompt.
      const cleaned = t.trim();
      const looksLikeName =
        cleaned.split(/\s+/).length <= 2 &&
        /^[અ-હ઀-૿a-zA-Z.\s]{2,30}$/.test(cleaned) &&
        !findCourse(cleaned) &&
        !/fee|course|કોર્સ|ફી|admission|એડમિશન|placement|hostel|scholarship|નમસ્તે|હેલો|hi|hello|હા|ના|નથી|yes|no/i.test(cleaned);
      if (looksLikeName) updates.student_name = cleaned;
    }
  }
  return updates;
}

// Answer an informational question from the KB, if the user asked one.
// `knownCourse` is the course already established in the conversation, so
// follow-ups like "and the fees?" resolve without naming the course again.
function answerQuery(text, knownCourse) {
  const t = (text || "").toLowerCase();

  if (/scholarship|શિષ્યવૃત્તિ|સ્કોલરશિપ|mysy/i.test(t)) return facts.scholarship_gu();
  if (/hostel|હોસ્ટેલ|રહેવા/i.test(t)) return "હા, છોકરા અને છોકરીઓ માટે અલગ હોસ્ટેલ, મેસ, Wi-Fi અને ૨૪ કલાક સુરક્ષા કેમ્પસમાં ઉપલબ્ધ છે.";
  if (/document|ડોક્યુમેન્ટ|દસ્તાવેજ|કાગળ/i.test(t)) return "૧૦મા અને ૧૨માની માર્કશીટ, school leaving certificate, આધાર કાર્ડ, ફોટા અને category certificate (જો લાગુ પડે તો) જોઈશે.";
  if (/process|પ્રક્રિયા|admission કેવી રીતે|એડમિશન કેવી|how to/i.test(t)) return "admissions.rku.ac.in પર form ભરો અથવા કેમ્પસ આવો, માર્કશીટ અને ID આપો, પછી counselling અને fee ભરીને seat confirm થાય છે.";
  if (/campus|કેમ્પસ|ક્યાં|location|address|સરનામ/i.test(t)) return "અમારું કેમ્પસ રાજકોટ-ભાવનગર હાઇવે, કસ્તુરબાધામ, Rajkot ખાતે ૨૮૦ એકરમાં ફેલાયેલું છે.";

  const course = findCourse(t) || knownCourse;
  if (course && /fee|fees|ફી|ખર્ચ/i.test(t)) return `${course.name} ની indicative fee ${course.fees_indicative} છે. ચોક્કસ આંકડો admission ટીમ confirm કરી આપશે.`;
  if (course && /placement|પ્લેસમેન્ટ|નોકરી|job/i.test(t)) return `${course.name} માટે: ${course.placement}`;
  if (course && /eligib|યોગ્યતા|qualification|માટે શું|criteria/i.test(t)) return `${course.name} માટે eligibility: ${course.eligibility}`;
  if (course && /duration|સમય|વર્ષ|કેટલા/i.test(t)) return `${course.name} ની duration ${course.duration} છે.`;
  if (course && /વિશે|વધુ|more|tell|બતાવ|detail|માહિતી/i.test(t)) {
    const spec = course.specializations.length ? ` એમાં ${course.specializations.slice(0, 3).join(", ")} જેવી specializations છે.` : "";
    return `${course.name} એ ${course.duration} નો course છે. ${course.placement}${spec}`;
  }

  if (/course|courses|કોર્સ|અભ્યાસ|program|ભણ/i.test(t))
    return `RK University માં Engineering, Pharmacy, Physiotherapy, Computer Applications, Management અને Agriculture જેવા courses છે. તમને કયા ક્ષેત્રમાં રસ છે?`;

  return null;
}

// Helper used above (kept as a function so we can localise later).
facts.scholarship_gu = () =>
  "RK University board/entrance marks ના આધારે merit scholarship તેમજ MYSY, SC/ST/OBC જેવી સરકારી યોજનાઓ આપે છે. ચોક્કસ રકમ course અને marks પર આધાર રાખે છે.";

// Question asked for each lead field, used in the flow order below.
const QUESTIONS = {
  student_name: "પહેલા, હું તમારું નામ જાણી શકું?",
  course_interest: "તમને કયા course માં રસ છે?",
  qualification: "તમારો છેલ્લો અભ્યાસ — qualification શું છે?",
  mobile_number: "છેલ્લે, follow-up માટે તમારો મોબાઇલ નંબર આપી શકશો?",
};

const GREETINGS = {
  inbound: "નમસ્તે, RK University માં કોલ કરવા બદલ આભાર. હું આજે તમારી શું મદદ કરી શકું?",
  outbound: (name) =>
    `નમસ્તે! હું RK University ની admission સહાયક બોલું છું. તમારી ઉચ્ચ અભ્યાસ અને admission અંગેની માહિતી આપવા કોલ કર્યો છે. ${name ? `શું હું ${name} સાથે વાત કરી રહ્યો છું?` : "શું હું જાણી શકું કે હું કોની સાથે વાત કરી રહ્યો છું?"}`,
};

const CLOSING = "RK University માં રસ દાખવવા બદલ આભાર. કોઈ પણ વધારાની મદદ જોઈએ તો જરૂર સંપર્ક કરજો. તમારો દિવસ શુભ રહે.";

export function mockReply(history, ctx = {}) {
  const lead = ctx.lead || {};
  const userTurns = history.filter((m) => m.role === "user");
  const lastUser = userTurns.length ? userTurns[userTurns.length - 1].content : "";

  // First turn — greet.
  if (userTurns.length === 0) {
    const greet = ctx.direction === "outbound" ? GREETINGS.outbound(ctx.studentName) : GREETINGS.inbound;
    return { reply: greet, leadUpdates: {}, endCall: false };
  }

  // End on an explicit goodbye (note: bare "આભાર" no longer ends the call,
  // so "ના આભાર" to the course-questions offer keeps the lead flow going).
  if (/bye|good ?bye|thank you|ધન્યવાદ|બસ આટલું|રાખું|મૂકું/i.test(lastUser)) {
    return { reply: CLOSING, leadUpdates: {}, endCall: true };
  }

  const leadUpdates = extractLead(lastUser, lead);
  const merged = { ...lead, ...leadUpdates };
  const knownCourse = courses.find((c) => c.name === merged.course_interest) || null;

  // Busy on an outbound call — offer a callback.
  if (ctx.direction === "outbound" && /busy|વ્યસ્ત|પછી|અત્યારે નહીં|સમય નથી/i.test(lastUser)) {
    return { reply: "ચોક્કસ, કોઈ વાંધો નહીં. તમને ક્યારે callback કરવો અનુકૂળ રહેશે?", leadUpdates, endCall: false };
  }

  const parts = [];
  const ack = ["ચોક્કસ.", "જરૂર.", "સરસ.", "સમજ્યો."][userTurns.length % 4];

  // The moment the course is captured, proactively state its eligibility criteria.
  if (leadUpdates.course_interest && knownCourse) {
    parts.push(`સરસ પસંદગી! ${knownCourse.name} માટે eligibility: ${knownCourse.eligibility}`);
  }

  // Answer any KB question the caller asked (fees, placement, scholarship, …).
  const answer = answerQuery(lastUser, knownCourse);
  if (answer) parts.push(answer);

  // Flow order: name → course → qualification, then a "want to know more about
  // this course?" gate (Q&A), then mobile. (No percentage / city / passing year.)
  const preFields = ["student_name", "course_interest", "qualification"];
  const missingPre = preFields.find((f) => !merged[f]);

  if (missingPre) {
    parts.push(QUESTIONS[missingPre]);
  } else if (merged.course_qna !== "done") {
    if (merged.course_qna !== "offered") {
      // First time all academic details are in — invite course questions.
      leadUpdates.course_qna = "offered";
      parts.push(`શું તમે ${knownCourse ? knownCourse.name + " " : ""}course વિશે વધુ જાણવા માંગો છો — fees, placement કે બીજું કંઈ?`);
    } else if (/ના|નથી|નહીં|નહિ|\bno\b|બસ|આગળ/i.test(lastUser) && !answer) {
      // Caller declined more info — move on to the mobile number.
      leadUpdates.course_qna = "done";
      parts.push(QUESTIONS.mobile_number);
    } else if (answer) {
      parts.push("બીજું કંઈ આ course વિશે પૂછવું છે? ના હોય તો આગળ વધીએ.");
    } else {
      parts.push("ચોક્કસ, પૂછો — fees, placement, scholarship, hostel… જે જાણવું હોય.");
    }
  } else if (!merged.mobile_number) {
    parts.push(QUESTIONS.mobile_number);
  } else {
    parts.push("તમારી બધી વિગતો નોંધી લીધી છે. આપણી admission ટીમ ટૂંક સમયમાં follow-up કરશે. બીજું કંઈ પૂછવું છે?");
  }

  let reply = parts.join(" ");
  // Light acknowledgement only when we didn't already lead with an answer/eligibility.
  if (!answer && !leadUpdates.course_interest) reply = `${ack} ${reply}`;

  return { reply: reply.trim(), leadUpdates, endCall: false };
}
