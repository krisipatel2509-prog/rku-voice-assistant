"""Offline rule-based Gujarati counselor (ported from src/llm/mock.js)."""
import re

from ..data.courses import courses, find_course

GUJARAT_CITIES = [
    "રાજકોટ", "અમદાવાદ", "સુરત", "વડોદરા", "ભાવનગર", "જામનગર", "જૂનાગઢ",
    "ગાંધીનગર", "આણંદ", "મોરબી", "ગોંડલ", "મહેસાણા", "rajkot", "ahmedabad",
    "surat", "vadodara", "bhavnagar", "jamnagar", "junagadh",
]

SCHOLARSHIP_GU = ("RK University board/entrance marks ના આધારે merit scholarship તેમજ MYSY, "
                  "SC/ST/OBC જેવી સરકારી યોજનાઓ આપે છે. ચોક્કસ રકમ course અને marks પર આધાર રાખે છે.")

QUESTIONS = {
    "student_name": "પહેલા, હું તમારું નામ જાણી શકું?",
    "course_interest": "તમને કયા course માં રસ છે?",
    "qualification": "તમારો છેલ્લો અભ્યાસ — qualification શું છે?",
    "mobile_number": "છેલ્લે, follow-up માટે તમારો મોબાઇલ નંબર આપી શકશો?",
}

CLOSING = ("RK University માં રસ દાખવવા બદલ આભાર. કોઈ પણ વધારાની મદદ જોઈએ તો જરૂર સંપર્ક કરજો. "
           "તમારો દિવસ શુભ રહે.")


def _greeting(direction, name=""):
    if direction == "outbound":
        tail = (f"શું હું {name} સાથે વાત કરી રહ્યો છું?" if name
                else "શું હું જાણી શકું કે હું કોની સાથે વાત કરી રહ્યો છું?")
        return ("નમસ્તે! હું RK University ની admission સહાયક બોલું છું. તમારી ઉચ્ચ અભ્યાસ અને "
                f"admission અંગેની માહિતી આપવા કોલ કર્યો છે. {tail}")
    return "નમસ્તે, RK University માં કોલ કરવા બદલ આભાર. હું આજે તમારી શું મદદ કરી શકું?"


def _extract_lead(text, lead):
    updates = {}
    t = text or ""

    if not lead.get("mobile_number"):
        m = re.search(r"\b([6-9]\d{9})\b", re.sub(r"[\s-]", "", t))
        if m:
            updates["mobile_number"] = m.group(1)
    if not lead.get("percentage"):
        p = re.search(r"(\d{1,3}(?:\.\d+)?)\s*(?:%|ટકા|percent|percentage|cgpa|સીજીપીએ)", t, re.I)
        if not p:
            p = re.match(r"^(\d{1,2}(?:\.\d+)?|100)$", t.strip())
        if p:
            updates["percentage"] = p.group(1)
    if not lead.get("passing_year"):
        y = re.search(r"\b(20\d{2}|19\d{2})\b", t)
        if y:
            updates["passing_year"] = y.group(1)
    if not lead.get("city"):
        city = next((c for c in GUJARAT_CITIES if c.lower() in t.lower()), None)
        if city:
            updates["city"] = city
    if not lead.get("course_interest"):
        c = find_course(t)
        if c:
            updates["course_interest"] = c["name"]
    if not lead.get("qualification"):
        if re.search(r"12\s*(th|મું)?|બારમ|hsc|science|commerce|arts|graduat|સ્નાતક|ગ્રેજ્યુએ", t, re.I):
            updates["qualification"] = "Graduate" if re.search(r"graduat|સ્નાતક|ગ્રેજ્યુએ", t, re.I) else "12th"
        elif re.search(r"10\s*(th|મું)?|દસમ|ssc", t, re.I):
            updates["qualification"] = "10th"
    if not lead.get("student_name"):
        nm = re.search(r"(?:મારું નામ|નામ છે|હું)\s+([અ-હ઀-૿a-zA-Z]{2,20})", t)
        if nm:
            updates["student_name"] = nm.group(1)
        else:
            cleaned = t.strip()
            looks_like_name = (
                len(cleaned.split()) <= 2
                and re.fullmatch(r"[અ-હ઀-૿a-zA-Z.\s]{2,30}", cleaned) is not None
                and not find_course(cleaned)
                and not re.search(
                    r"fee|course|કોર્સ|ફી|admission|એડમિશન|placement|hostel|scholarship|"
                    r"નમસ્તે|હેલો|hi|hello|હા|ના|નથી|yes|no", cleaned, re.I)
            )
            if looks_like_name:
                updates["student_name"] = cleaned
    return updates


def _answer_query(text, known_course):
    t = (text or "").lower()
    course = find_course(t) or known_course

    if re.search(r"scholarship|શિષ્યવૃત્તિ|સ્કોલરશિપ|mysy", t, re.I):
        return course["scholarship_information"] if course else SCHOLARSHIP_GU
    if re.search(r"hostel|હોસ્ટેલ|રહેવા", t, re.I):
        base = "હા, છોકરા અને છોકરીઓ માટે અલગ હોસ્ટેલ, મેસ, Wi-Fi અને ૨૪ કલાક સુરક્ષા કેમ્પસમાં ઉપલબ્ધ છે."
        return base + (f" હોસ્ટેલ ફી {course['hostel_fees']}." if course else "")
    if re.search(r"document|ડોક્યુમેન્ટ|દસ્તાવેજ|કાગળ", t, re.I):
        return ("૧૦મા અને ૧૨માની માર્કશીટ, school leaving certificate, આધાર કાર્ડ, ફોટા અને "
                "category certificate (જો લાગુ પડે તો) જોઈશે.")
    if re.search(r"process|પ્રક્રિયા|admission કેવી રીતે|એડમિશન કેવી|how to", t, re.I):
        return ("admissions.rku.ac.in પર form ભરો અથવા કેમ્પસ આવો, માર્કશીટ અને ID આપો, પછી "
                "counselling અને fee ભરીને seat confirm થાય છે.")
    if re.search(r"campus|કેમ્પસ|ક્યાં|location|address|સરનામ", t, re.I):
        return "અમારું કેમ્પસ રાજકોટ-ભાવનગર હાઇવે, કસ્તુરબાધામ, Rajkot ખાતે ૨૮૦ એકરમાં ફેલાયેલું છે."

    if course and re.search(r"fee|fees|ફી|ખર્ચ", t, re.I):
        return (f"{course['name']} ની ફી — વાર્ષિક {course['annual_fees']}, કુલ આશરે "
                f"{course['total_fees']}. ચોક્કસ આંકડો admission ટીમ confirm કરી આપશે.")
    if course and re.search(r"placement|પ્લેસમેન્ટ|નોકરી|job", t, re.I):
        return f"{course['name']} માટે: {course['placement']}"
    if course and re.search(r"eligib|યોગ્યતા|qualification|માટે શું|criteria", t, re.I):
        return f"{course['name']} માટે eligibility: {course['eligibility']}"
    if course and re.search(r"duration|સમય|વર્ષ|કેટલા", t, re.I):
        return f"{course['name']} ની duration {course['duration']} છે."
    if course and re.search(r"વિશે|વધુ|more|tell|બતાવ|detail|માહિતી", t, re.I):
        spec = (f" એમાં {', '.join(course['specializations'][:3])} જેવી specializations છે."
                if course["specializations"] else "")
        return f"{course['name']} એ {course['duration']} નો course છે. {course['placement']}{spec}"

    if re.search(r"course|courses|કોર્સ|અભ્યાસ|program|ભણ", t, re.I):
        return ("RK University માં Engineering, Pharmacy, Physiotherapy, Computer Applications, "
                "Management અને Agriculture જેવા courses છે. તમને કયા ક્ષેત્રમાં રસ છે?")
    return None


def mock_reply(history, ctx=None):
    ctx = ctx or {}
    lead = ctx.get("lead") or {}
    user_turns = [m for m in history if m["role"] == "user"]
    last_user = user_turns[-1]["content"] if user_turns else ""

    if not user_turns:
        return {"reply": _greeting(ctx.get("direction"), ctx.get("studentName", "")), "leadUpdates": {}, "endCall": False}

    if re.search(r"bye|good ?bye|thank you|ધન્યવાદ|બસ આટલું|રાખું|મૂકું", last_user, re.I):
        return {"reply": CLOSING, "leadUpdates": {}, "endCall": True}

    lead_updates = _extract_lead(last_user, lead)
    merged = {**lead, **lead_updates}
    known_course = next((c for c in courses if c["name"] == merged.get("course_interest")), None)

    if ctx.get("direction") == "outbound" and re.search(r"busy|વ્યસ્ત|પછી|અત્યારે નહીં|સમય નથી", last_user, re.I):
        return {"reply": "ચોક્કસ, કોઈ વાંધો નહીં. તમને ક્યારે callback કરવો અનુકૂળ રહેશે?",
                "leadUpdates": lead_updates, "endCall": False}

    parts = []
    ack = ["ચોક્કસ.", "જરૂર.", "સરસ.", "સમજ્યો."][len(user_turns) % 4]

    if lead_updates.get("course_interest") and known_course:
        parts.append(f"સરસ પસંદગી! {known_course['name']} માટે eligibility: {known_course['eligibility']}")

    answer = _answer_query(last_user, known_course)
    if answer:
        parts.append(answer)

    pre_fields = ["student_name", "course_interest", "qualification"]
    missing_pre = next((f for f in pre_fields if not merged.get(f)), None)

    if missing_pre:
        parts.append(QUESTIONS[missing_pre])
    elif merged.get("course_qna") != "done":
        if merged.get("course_qna") != "offered":
            lead_updates["course_qna"] = "offered"
            label = (known_course["name"] + " ") if known_course else ""
            parts.append(f"શું તમે {label}course વિશે વધુ જાણવા માંગો છો — fees, placement કે બીજું કંઈ?")
        elif re.search(r"ના|નથી|નહીં|નહિ|\bno\b|બસ|આગળ", last_user, re.I) and not answer:
            lead_updates["course_qna"] = "done"
            parts.append(QUESTIONS["mobile_number"])
        elif answer:
            parts.append("બીજું કંઈ આ course વિશે પૂછવું છે? ના હોય તો આગળ વધીએ.")
        else:
            parts.append("ચોક્કસ, પૂછો — fees, placement, scholarship, hostel… જે જાણવું હોય.")
    elif not merged.get("mobile_number"):
        parts.append(QUESTIONS["mobile_number"])
    else:
        parts.append("તમારી બધી વિગતો નોંધી લીધી છે. આપણી admission ટીમ ટૂંક સમયમાં follow-up કરશે. બીજું કંઈ પૂછવું છે?")

    reply = " ".join(parts)
    if not answer and not lead_updates.get("course_interest"):
        reply = f"{ack} {reply}"
    return {"reply": reply.strip(), "leadUpdates": lead_updates, "endCall": False}
