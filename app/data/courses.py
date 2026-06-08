"""RK University course knowledge base — loaded from knowledge_base.json.

The JSON holds the rich per-course structure (course_name, duration, eligibility,
annual_fees, total_fees, hostel_fees, scholarship_information, ...). Here we load
it and add a couple of backward-compatible aliases (`name`, `fees_indicative`) so
the rest of the app keeps working unchanged.
"""
import json
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(_HERE, "knowledge_base.json"), "r", encoding="utf-8") as _f:
    _KB = json.load(_f)

university = _KB["university"]

courses = []
for _c in _KB["courses"]:
    c = dict(_c)
    c["name"] = c["course_name"]            # alias used across the app
    c["fees_indicative"] = c["annual_fees"]  # alias for the fee answer
    courses.append(c)

# General cross-cutting facts (per-course scholarships live on each course).
facts = {
    "scholarship": "RK University offers merit scholarships based on board/entrance marks, plus government schemes (MYSY, SC/ST/OBC). The exact amount depends on the course and marks — the admission team confirms eligibility.",
    "hostel": "Separate hostel facilities for boys and girls with mess, Wi-Fi, and 24x7 security are available on campus.",
    "campus": "The campus is at Rajkot–Bhavnagar Highway, Kasturbadham, Rajkot, Gujarat — a 280+ acre campus.",
    "admissionProcess": "Fill the inquiry/application on admissions.rku.ac.in or visit campus, submit 10th/12th marksheets and ID proof, then complete counselling and fee payment to confirm the seat.",
    "documents": "10th & 12th marksheets, school leaving certificate, ID proof (Aadhaar), passport photos, and category certificate (if applicable).",
}


def knowledge_text() -> str:
    lines = []
    lines.append(f"UNIVERSITY: {university['name']}, {university['city']}, {university['state']}.")
    lines.append(f"Website {university['website']} | Portal {university['admissionsPortal']} | "
                 f"Email {university['email']} | Helpline {', '.join(university['helplines'])}.")
    lines.append("")
    lines.append("COURSES:")
    for c in courses:
        spec = f" Specializations: {', '.join(c['specializations'])}." if c.get("specializations") else ""
        lines.append(
            f"- {c['course_name']} [{c['level']}, {c['school']}] | Duration: {c['duration']} | "
            f"Eligibility: {c['eligibility']} | Annual fees: {c['annual_fees']} | "
            f"Total fees: {c['total_fees']} | Hostel: {c['hostel_fees']} | "
            f"Scholarship: {c['scholarship_information']} | Placement: {c['placement']}.{spec}"
        )
    lines.append("")
    lines.append("GENERAL FACTS:")
    for k, v in facts.items():
        lines.append(f"- {k}: {v}")
    return "\n".join(lines)


def find_course(text: str):
    t = (text or "").lower()
    best, best_score = None, 0
    for c in courses:
        score = 0
        for kw in c["keywords"]:
            if kw.lower() in t:
                score += len(kw)
        if score > best_score:
            best_score, best = score, c
    return best if best_score > 0 else None
