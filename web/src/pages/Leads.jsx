import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [q, setQ] = useState("");
  const [dir, setDir] = useState("all");
  const [err, setErr] = useState("");

  useEffect(() => {
    api.leads().then(setLeads).catch((e) => setErr(e.message));
  }, []);

  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return leads.filter((l) => {
      if (dir !== "all" && (l.direction || "inbound") !== dir) return false;
      if (!term) return true;
      return [l.student_name, l.mobile_number, l.city, l.course_interest]
        .some((v) => (v || "").toLowerCase().includes(term));
    });
  }, [leads, q, dir]);

  function exportCsv() {
    const cols = ["student_name", "mobile_number", "city", "course_interest", "qualification", "passing_year", "percentage", "direction", "updatedAt"];
    const head = cols.join(",");
    const rows = filtered.map((l) => cols.map((c) => `"${(l[c] ?? "").toString().replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[head, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rku-leads.csv";
    a.click();
  }

  if (err) return <div className="note err">{err}</div>;

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div className="row" style={{ gap: 10 }}>
          <input style={{ width: 240 }} placeholder="Search name, phone, city…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select style={{ width: 140 }} value={dir} onChange={(e) => setDir(e.target.value)}>
            <option value="all">All calls</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <span className="muted">{filtered.length} leads</span>
          <button className="btn sm ghost" onClick={exportCsv}>⤓ Export CSV</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">No leads match.</div>
      ) : (
        <table>
          <thead>
            <tr><th>Name</th><th>Mobile</th><th>City</th><th>Course</th><th>Qualification</th><th>%</th><th>Dir</th><th>Updated</th></tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.sessionId}>
                <td>{l.student_name || <span className="muted">—</span>}</td>
                <td>{l.mobile_number || <span className="muted">—</span>}</td>
                <td>{l.city || <span className="muted">—</span>}</td>
                <td>{l.course_interest || <span className="muted">—</span>}</td>
                <td>{l.qualification || <span className="muted">—</span>}</td>
                <td>{l.percentage || <span className="muted">—</span>}</td>
                <td><span className={"tag " + (l.direction || "inbound")}>{l.direction || "inbound"}</span></td>
                <td className="muted">{l.updatedAt ? new Date(l.updatedAt).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
