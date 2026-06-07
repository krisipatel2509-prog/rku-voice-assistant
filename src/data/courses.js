// RK University — course knowledge base.
// Scraped/derived from https://rku.ac.in (programs listing). Ten flagship
// courses used by the admission assistant to answer queries accurately.
// NOTE: fees/intake are indicative for the demo — confirm with the admission
// cell before quoting officially. The assistant is instructed never to guess
// beyond this data.

export const university = {
  name: "RK University",
  city: "Rajkot",
  state: "Gujarat",
  website: "https://rku.ac.in",
  admissionsPortal: "https://admissions.rku.ac.in",
  email: "info@rku.ac.in",
  helplines: ["+91-9712489122", "+91-9925714450"],
  reception: ["+91-9909952030", "+91-9909952031"],
};

export const courses = [
  {
    id: "btech",
    name: "B.Tech (Bachelor of Technology)",
    name_gu: "બી.ટેક (બેચલર ઓફ ટેકનોલોજી)",
    school: "School of Engineering",
    level: "UG",
    duration: "4 years (8 semesters)",
    specializations: [
      "Computer Science & Engineering",
      "Artificial Intelligence & Machine Learning",
      "AI & Data Science",
      "Information Technology",
      "Mechanical",
      "Electrical",
      "Civil",
    ],
    eligibility:
      "12th Science (PCM) pass with at least 45% (40% for reserved category). ACPC / JEE / direct admission accepted.",
    fees_indicative: "Approx. ₹85,000 – ₹1,15,000 per year (branch dependent).",
    placement: "Strong campus placements; top recruiters in IT & core sectors.",
    keywords: ["btech", "b.tech", "engineering", "cse", "ai", "ml", "data science", "it", "mechanical", "civil", "electrical", "એન્જિનિયરિંગ", "બીટેક"],
  },
  {
    id: "diploma-engg",
    name: "Diploma in Engineering (D.Engg.)",
    name_gu: "ડિપ્લોમા ઇન એન્જિનિયરિંગ",
    school: "School of Diploma Studies",
    level: "Diploma",
    duration: "3 years (6 semesters)",
    specializations: ["Computer", "Mechanical", "Electrical", "Civil"],
    eligibility: "10th pass (SSC). Direct second-year entry for ITI students.",
    fees_indicative: "Approx. ₹45,000 – ₹60,000 per year.",
    placement: "Industry-linked training, internship and placement support.",
    keywords: ["diploma", "polytechnic", "after 10th", "ડિપ્લોમા"],
  },
  {
    id: "bpharm",
    name: "B.Pharm (Bachelor of Pharmacy)",
    name_gu: "બી.ફાર્મ (બેચલર ઓફ ફાર્મસી)",
    school: "School of Pharmacy",
    level: "UG",
    duration: "4 years (8 semesters)",
    specializations: [],
    eligibility:
      "12th Science (PCB/PCM) pass with at least 45%. PCI-approved program.",
    fees_indicative: "Approx. ₹95,000 – ₹1,10,000 per year.",
    placement: "Placements in pharma manufacturing, QA/QC, and marketing.",
    keywords: ["bpharm", "b.pharm", "pharmacy", "pharma", "ફાર્મસી", "ફાર્મ"],
  },
  {
    id: "pharmd",
    name: "Pharm.D (Doctor of Pharmacy)",
    name_gu: "ફાર્મ.ડી (ડોક્ટર ઓફ ફાર્મસી)",
    school: "School of Pharmacy",
    level: "UG (Doctoral-level professional)",
    duration: "6 years (5 academic + 1 year internship)",
    specializations: [],
    eligibility: "12th Science (PCB/PCM) pass with at least 50%.",
    fees_indicative: "Approx. ₹1,10,000 – ₹1,30,000 per year.",
    placement: "Clinical pharmacy, hospitals, and pharmacovigilance roles.",
    keywords: ["pharmd", "pharm.d", "doctor of pharmacy", "ફાર્મડી"],
  },
  {
    id: "bpt",
    name: "BPT (Bachelor of Physiotherapy)",
    name_gu: "બી.પી.ટી (બેચલર ઓફ ફિઝિયોથેરાપી)",
    school: "School of Physiotherapy",
    level: "UG",
    duration: "4.5 years (4 academic + 6 months internship)",
    specializations: [],
    eligibility: "12th Science (PCB) pass with at least 50%.",
    fees_indicative: "Approx. ₹90,000 – ₹1,05,000 per year.",
    placement: "Hospitals, sports clinics, rehabilitation centres.",
    keywords: ["bpt", "physiotherapy", "physio", "ફિઝિયોથેરાપી", "ફિઝિયો"],
  },
  {
    id: "bca",
    name: "BCA (Bachelor of Computer Applications)",
    name_gu: "બી.સી.એ (બેચલર ઓફ કમ્પ્યુટર એપ્લિકેશન્સ)",
    school: "School of Computer Applications",
    level: "UG",
    duration: "3 years (6 semesters)",
    specializations: [],
    eligibility: "12th pass (any stream) with at least 45%.",
    fees_indicative: "Approx. ₹55,000 – ₹70,000 per year.",
    placement: "Software development, support, and IT services roles.",
    keywords: ["bca", "computer applications", "computer", "સીસીએ", "બીસીએ", "કમ્પ્યુટર"],
  },
  {
    id: "mca",
    name: "MCA (Master of Computer Applications)",
    name_gu: "એમ.સી.એ (માસ્ટર ઓફ કમ્પ્યુટર એપ્લિકેશન્સ)",
    school: "School of Computer Applications",
    level: "PG",
    duration: "2 years (4 semesters)",
    specializations: [],
    eligibility:
      "Graduation with Mathematics at 10+2 or graduate level; min 50%. CMAT/direct.",
    fees_indicative: "Approx. ₹70,000 – ₹85,000 per year.",
    placement: "Higher software/engineering roles, better packages than BCA.",
    keywords: ["mca", "master of computer applications", "એમસીએ"],
  },
  {
    id: "bba",
    name: "BBA (Bachelor of Business Administration)",
    name_gu: "બી.બી.એ (બેચલર ઓફ બિઝનેસ એડમિનિસ્ટ્રેશન)",
    school: "School of Management",
    level: "UG",
    duration: "3 years (6 semesters)",
    specializations: ["Standard", "Applied Management", "Entrepreneurship & Family Business"],
    eligibility: "12th pass (any stream) with at least 45%.",
    fees_indicative: "Approx. ₹60,000 – ₹75,000 per year.",
    placement: "Management trainee, sales, operations, family-business track.",
    keywords: ["bba", "business administration", "management", "બીબીએ"],
  },
  {
    id: "mba",
    name: "MBA (Master of Business Administration)",
    name_gu: "એમ.બી.એ (માસ્ટર ઓફ બિઝનેસ એડમિનિસ્ટ્રેશન)",
    school: "School of Management",
    level: "PG",
    duration: "2 years (4 semesters)",
    specializations: ["Standard", "Banking & Finance", "Entrepreneurship & Family Business"],
    eligibility: "Graduation with min 50%. CMAT / CAT / MAT score preferred.",
    fees_indicative: "Approx. ₹95,000 – ₹1,20,000 per year.",
    placement: "Finance, marketing, HR and operations placements.",
    keywords: ["mba", "business administration", "management", "એમબીએ"],
  },
  {
    id: "bsc-agri",
    name: "B.Sc. Agriculture",
    name_gu: "બી.એસ.સી એગ્રીકલ્ચર",
    school: "School of Agriculture",
    level: "UG",
    duration: "4 years (8 semesters)",
    specializations: [],
    eligibility: "12th Science (PCB/PCM/Agriculture) with at least 50%.",
    fees_indicative: "Approx. ₹80,000 – ₹95,000 per year.",
    placement: "Agri-business, government agri schemes, agro-industries.",
    keywords: ["agriculture", "agri", "bsc agriculture", "એગ્રીકલ્ચર", "ખેતી"],
  },
];

// Common cross-cutting facts the counselor often needs.
export const facts = {
  scholarship:
    "RK University offers merit scholarships based on board/entrance marks, plus government schemes (MYSY, SC/ST/OBC). The exact amount depends on the course and marks — the admission team confirms eligibility.",
  hostel:
    "Separate hostel facilities for boys and girls with mess, Wi-Fi, and 24x7 security are available on campus.",
  campus:
    "The campus is at Rajkot–Bhavnagar Highway, Kasturbadham, Rajkot, Gujarat — a 280+ acre campus.",
  admissionProcess:
    "Fill the inquiry/application on admissions.rku.ac.in or visit campus, submit 10th/12th marksheets and ID proof, then complete counselling and fee payment to confirm the seat.",
  documents:
    "10th & 12th marksheets, school leaving certificate, ID proof (Aadhaar), passport photos, and category certificate (if applicable).",
};

// Build a compact, model-friendly text block for the LLM context.
export function knowledgeText() {
  const lines = [];
  lines.push(`UNIVERSITY: ${university.name}, ${university.city}, ${university.state}.`);
  lines.push(`Website ${university.website} | Portal ${university.admissionsPortal} | Email ${university.email} | Helpline ${university.helplines.join(", ")}.`);
  lines.push("");
  lines.push("COURSES:");
  for (const c of courses) {
    const spec = c.specializations.length ? ` Specializations: ${c.specializations.join(", ")}.` : "";
    lines.push(
      `- ${c.name} [${c.level}, ${c.school}] | Duration: ${c.duration} | Eligibility: ${c.eligibility} | Fees: ${c.fees_indicative} | Placement: ${c.placement}.${spec}`
    );
  }
  lines.push("");
  lines.push("GENERAL FACTS:");
  for (const [k, v] of Object.entries(facts)) lines.push(`- ${k}: ${v}`);
  return lines.join("\n");
}

// Lightweight keyword lookup for the offline/mock assistant.
export function findCourse(text) {
  const t = (text || "").toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const c of courses) {
    let score = 0;
    for (const kw of c.keywords) if (t.includes(kw.toLowerCase())) score += kw.length;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore > 0 ? best : null;
}
