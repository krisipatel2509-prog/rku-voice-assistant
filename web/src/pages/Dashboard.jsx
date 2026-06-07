import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

function Stat({ label, value, sub, tone }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className={"value " + (tone || "")}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const load = () => api.stats().then(setS).catch((e) => setErr(e.message));
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  if (err) return <div className="note err">{err}</div>;
  if (!s) return <div className="empty">Loading…</div>;

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="grid cols-4">
        <Stat label="Total leads" value={s.totalLeads} tone="brand" />
        <Stat label="Qualified leads" value={s.qualifiedLeads} tone="green" sub={`${s.conversionRate}% conversion`} />
        <Stat label="Calls today" value={s.callsToday} />
        <Stat label="Active calls now" value={s.activeCalls} tone={s.activeCalls ? "green" : ""} sub={<Link to="/live" className="muted">Open live monitor →</Link>} />
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Call direction</h3>
          <div className="row between">
            <div className="stat"><div className="label">Inbound</div><div className="value green">{s.inbound}</div></div>
            <div className="stat"><div className="label">Outbound</div><div className="value brand">{s.outbound}</div></div>
          </div>
        </div>
        <div className="card">
          <h3>Quick actions</h3>
          <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
            <Link className="btn sm" to="/dialer">☎ New call</Link>
            <Link className="btn sm ghost" to="/campaigns">✦ Campaigns</Link>
            <Link className="btn sm ghost" to="/analytics">▤ Analytics</Link>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Recent leads</h3>
        {s.recent.length === 0 ? (
          <div className="empty">No leads yet — start a call to capture one.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Name</th><th>Mobile</th><th>City</th><th>Course</th><th>Dir</th><th>Updated</th></tr>
            </thead>
            <tbody>
              {s.recent.map((l) => (
                <tr key={l.sessionId}>
                  <td>{l.student_name || <span className="muted">—</span>}</td>
                  <td>{l.mobile_number || <span className="muted">—</span>}</td>
                  <td>{l.city || <span className="muted">—</span>}</td>
                  <td>{l.course_interest || <span className="muted">—</span>}</td>
                  <td><span className={"tag " + (l.direction || "inbound")}>{l.direction || "inbound"}</span></td>
                  <td className="muted">{l.updatedAt ? new Date(l.updatedAt).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
