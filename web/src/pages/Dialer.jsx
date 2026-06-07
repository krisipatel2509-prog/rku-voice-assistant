import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Dialer() {
  const [status, setStatus] = useState(null);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [log, setLog] = useState([]);

  useEffect(() => {
    api.dialerStatus().then(setStatus).catch(() => setStatus({ twilioReady: false }));
  }, []);

  async function dial(e) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const { sid } = await api.call(phone, name);
      setResult({ ok: true, msg: `Calling ${phone}… (SID ${sid})` });
      setLog((l) => [{ phone, name, sid, at: new Date().toLocaleTimeString() }, ...l]);
      setPhone(""); setName("");
    } catch (err) {
      setResult({ ok: false, msg: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid cols-2" style={{ gap: 18, alignItems: "start" }}>
      <div className="card">
        <h3>Place an outbound call</h3>
        {status && !status.twilioReady && (
          <div className="note warn">
            Twilio isn’t fully configured. Set TWILIO_* keys and PUBLIC_URL (ngrok) in .env to place real calls.
          </div>
        )}
        <form onSubmit={dial} style={{ marginTop: 14 }}>
          <label className="field">
            <span>Phone number (E.164, e.g. +9198XXXXXXXX)</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+919800000000" required />
          </label>
          <label className="field">
            <span>Student name (optional)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Riya Patel" />
          </label>
          <button className="btn" disabled={busy || !phone}>{busy ? "Dialing…" : "☎ Call now"}</button>
        </form>
        {result && <div className={"note " + (result.ok ? "ok" : "err")}>{result.msg}</div>}
        {status?.from && <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>Calling from {status.from}</div>}
      </div>

      <div className="card">
        <h3>This session’s calls</h3>
        {log.length === 0 ? (
          <div className="empty">No calls placed yet.</div>
        ) : (
          <table>
            <thead><tr><th>Time</th><th>Name</th><th>Number</th><th>SID</th></tr></thead>
            <tbody>
              {log.map((c, i) => (
                <tr key={i}>
                  <td className="muted">{c.at}</td>
                  <td>{c.name || "—"}</td>
                  <td>{c.phone}</td>
                  <td className="muted" style={{ fontSize: 11 }}>{c.sid?.slice(0, 12)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
