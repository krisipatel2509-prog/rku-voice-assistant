import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Analytics from "./pages/Analytics.jsx";
import Dialer from "./pages/Dialer.jsx";
import Campaigns from "./pages/Campaigns.jsx";
import LiveMonitor from "./pages/LiveMonitor.jsx";
import Leads from "./pages/Leads.jsx";

function Protected({ children }) {
  const { authed } = useAuth();
  return authed ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/dialer" element={<Dialer />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/live" element={<LiveMonitor />} />
        <Route path="/leads" element={<Leads />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
