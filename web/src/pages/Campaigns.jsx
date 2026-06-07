import { useEffect, useState } from "react";
import { api } from "../api.js";

// Parse a textarea of "name, +phone" (or "+phone") lines into recipients.
function parseRecipients(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length >= 2) return { name: parts[0], phone: parts[1] };
      return { name: "", phone: parts[0] };
    })
    .filter((r) => r.phone);
}

export default function Campaigns() {
  const [list, setList] = useState([]);
  const [name, setName] = useState("");
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = () => api.campaigns().then(setList).catch((e) => setMsg({ ok: false, t: e.message }));
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    const recipients = parseRecipients(raw);
    if (!recipients.length) return setMsg({ ok: false, t: "Add at least one recipient." });
    setBusy(true);
    try {
      await api.createCampaign(name || "Untitled campaign", recipients);
      setName(""); setRaw(""); setMsg({ ok: true, t: "Campaign created." });
      load();
    } catch (err) {
      setMsg({ ok: false, t: err.message });
    } finally { setBusy(false); }
  }

  async function run(id) {
    setMsg({ ok: true, t: "Running campaign — placing calls…" });
    try {
      await api.runCampaign(id);
      setMsg({ ok: true, t: "Campaign finished." });
      load();
    } catch (err) {
      setMsg({ ok: false, t: err.message });
    }
  }

  async function remove(id) {
    await api.deleteCampaign(id);
    load();
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="card">
        <h3>New campaign</h3>
        <form onSubmit={create}>
          <label className="field">
            <span>Campaign name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="June B.Tech outreach" />
          </label>
          <label className="field">
            <span>Recipients — one per line: <code>Name, +91XXXXXXXXXX</code></span>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={"Riya Patel, +919800000001\nAmit Shah, +919800000002"}
            />
          </label>
          <button className="btn" disabled={busy}>Create campaign</button>
        </form>
        {msg && <div className={"note " + (msg.ok ? "ok" : "err")}>{msg.t}</div>}
      </div>

      <div className="card">
        <h3>Campaigns</h3>
        {list.length === 0 ? (
          <div className="empty">No campaigns yet.</div>
        ) : (
          <table>
            <thead><tr><th>Name</th><th>Recipients</th><th>Status</th><th>Results</th><th></th></tr></thead>
            <tbody>
              {list.map((c) => {
                const ok = (c.results || []).filter((r) => r.ok).length;
                return (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.recipients.length}</td>
                    <td><span className={"tag " + (c.status === "completed" ? "inbound" : "live")}>{c.status}</span></td>
                    <td className="muted">{c.results?.length ? `${ok}/${c.results.length} dialed` : "—"}</td>
                    <td className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                      <button className="btn sm" onClick={() => run(c.id)}>Run</button>
                      <button className="btn sm danger" onClick={() => remove(c.id)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
