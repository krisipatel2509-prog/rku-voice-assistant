import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await login(user, password);
      navigate("/");
    } catch (e) {
      setErr(e.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <div className="brand">
          <div className="logo">🎓</div>
          <div>
            RK University
            <small>Admin Panel</small>
          </div>
        </div>
        <label className="field">
          <span>Username</span>
          <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="admin" autoFocus />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
          />
        </label>
        <button className="btn" style={{ width: "100%" }} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {err && <div className="note err">{err}</div>}
        <div className="muted" style={{ fontSize: 12, marginTop: 14, textAlign: "center" }}>
          Default demo login: <b>admin</b> / <b>rku123</b> (set in .env)
        </div>
      </form>
    </div>
  );
}
