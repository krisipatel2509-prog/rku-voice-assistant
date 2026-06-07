import { useEffect, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { api } from "../api.js";

const COLORS = ["#4f7cff", "#2fbf71", "#f4b740", "#ef4f6b", "#9b6dff", "#3fc7d4", "#ff8a5c", "#6d92ff"];
const tip = { background: "#1e222e", border: "1px solid #2a2f3d", borderRadius: 8, color: "#e6e8ee" };

export default function Analytics() {
  const [a, setA] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.analytics().then(setA).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="note err">{err}</div>;
  if (!a) return <div className="empty">Loading…</div>;

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="card">
        <h3>Leads captured — last 14 days</h3>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={a.leadsByDay} margin={{ left: -18, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4f7cff" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#4f7cff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#2a2f3d" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: "#8b91a4", fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
            <YAxis allowDecimals={false} tick={{ fill: "#8b91a4", fontSize: 11 }} />
            <Tooltip contentStyle={tip} />
            <Area type="monotone" dataKey="count" stroke="#4f7cff" strokeWidth={2} fill="url(#g)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Course interest</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={a.courseBreakdown} layout="vertical" margin={{ left: 30, right: 12 }}>
              <CartesianGrid stroke="#2a2f3d" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fill: "#8b91a4", fontSize: 11 }} />
              <YAxis type="category" dataKey="course" width={110} tick={{ fill: "#8b91a4", fontSize: 11 }} />
              <Tooltip contentStyle={tip} cursor={{ fill: "#ffffff08" }} />
              <Bar dataKey="count" radius={[0, 5, 5, 0]}>
                {a.courseBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>Inbound vs Outbound</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={a.directionSplit} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={3}>
                {a.directionSplit.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Legend wrapperStyle={{ color: "#8b91a4", fontSize: 12 }} />
              <Tooltip contentStyle={tip} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3>Top cities</h3>
        {a.cityBreakdown.length === 0 ? <div className="empty">No data yet.</div> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={a.cityBreakdown} margin={{ left: -18, right: 8 }}>
              <CartesianGrid stroke="#2a2f3d" vertical={false} />
              <XAxis dataKey="city" tick={{ fill: "#8b91a4", fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#8b91a4", fontSize: 11 }} />
              <Tooltip contentStyle={tip} cursor={{ fill: "#ffffff08" }} />
              <Bar dataKey="count" fill="#2fbf71" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
