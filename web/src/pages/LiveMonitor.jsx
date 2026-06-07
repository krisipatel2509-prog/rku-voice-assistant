import { useEffect, useRef, useState } from "react";
import { liveStream } from "../api.js";

export default function LiveMonitor() {
  const [calls, setCalls] = useState({}); // id -> session snapshot
  const [connected, setConnected] = useState(false);
  const esRef = useRef(null);

  useEffect(() => {
    const es = liveStream();
    esRef.current = es;
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    const upsert = (s) => setCalls((c) => ({ ...c, [s.id]: s }));

    es.addEventListener("snapshot", (e) => {
      const { sessions } = JSON.parse(e.data);
      setCalls(Object.fromEntries(sessions.map((s) => [s.id, s])));
    });
    es.addEventListener("started", (e) => upsert(JSON.parse(e.data)));
    es.addEventListener("turn", (e) => upsert(JSON.parse(e.data)));
    es.addEventListener("ended", (e) => {
      const s = JSON.parse(e.data);
      // Keep it briefly visible as "ended", then drop it.
      setCalls((c) => ({ ...c, [s.id]: { ...s, ended: true } }));
      setTimeout(() => setCalls((c) => {
        const n = { ...c };
        delete n[s.id];
        return n;
      }), 6000);
    });

    return () => es.close();
  }, []);

  const active = Object.values(calls);

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="row between">
        <div className="row" style={{ gap: 8 }}>
          <span className="pulse" style={{ background: connected ? "#2fbf71" : "#ef4f6b" }} />
          <span className="muted">{connected ? "Live — listening for calls" : "Reconnecting…"}</span>
        </div>
        <span className="muted">{active.length} active call{active.length === 1 ? "" : "s"}</span>
      </div>

      {active.length === 0 ? (
        <div className="card empty">
          No active calls right now. Start a call from the <b>Dialer</b> or the browser simulator,
          or have someone ring the Twilio number — it’ll appear here in real time.
        </div>
      ) : (
        <div className="grid cols-2">
          {active.map((s) => (
            <div key={s.id} className={"card call-card"} style={s.ended ? { opacity: 0.5 } : {}}>
              <div className="row between">
                <div>
                  <b>{s.studentName || "Unknown caller"}</b>
                  <div className="muted" style={{ fontSize: 12 }}>{s.phone || s.id}</div>
                </div>
                <span className={"tag " + (s.ended ? "outbound" : "live")}>
                  {s.ended ? "ended" : s.direction}
                </span>
              </div>

              <div className="transcript" style={{ marginTop: 14 }}>
                {s.transcript.length === 0 && <div className="muted">Waiting for first turn…</div>}
                {s.transcript.map((m, i) => (
                  <div key={i} className={"bubble " + m.role}>{m.content}</div>
                ))}
              </div>

              <div className="row" style={{ gap: 14, marginTop: 14, flexWrap: "wrap" }}>
                {s.lead.course_interest && <span className="muted">📚 {s.lead.course_interest}</span>}
                {s.lead.city && <span className="muted">📍 {s.lead.city}</span>}
                {s.lead.mobile_number && <span className="muted">📱 {s.lead.mobile_number}</span>}
                <span className="muted">{s.turns} turns</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
