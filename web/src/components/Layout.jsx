import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth.jsx";

const NAV = [
  { to: "/", label: "Dashboard", ico: "▦", end: true },
  { to: "/dialer", label: "Dialer", ico: "☎" },
  { to: "/live", label: "Live Monitor", ico: "◉" },
  { to: "/campaigns", label: "Campaigns", ico: "✦" },
  { to: "/analytics", label: "Analytics", ico: "▤" },
  { to: "/leads", label: "Leads", ico: "≣" },
];

const TITLES = {
  "/": "Dashboard",
  "/dialer": "Dialer",
  "/live": "Live Call Monitor",
  "/campaigns": "Campaigns",
  "/analytics": "Analytics",
  "/leads": "Leads",
};

export default function Layout() {
  const { logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">🎓</div>
          <div>
            RK University
            <small>Admission Assistant</small>
          </div>
        </div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
          >
            <span className="ico">{n.ico}</span>
            {n.label}
          </NavLink>
        ))}
        <div className="spacer" />
        <button className="logout" onClick={logout}>
          ⎋ Sign out
        </button>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1>{TITLES[pathname] || "Admin"}</h1>
          <div className="muted" style={{ fontSize: 13 }}>Gujarati Voice Admissions</div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
