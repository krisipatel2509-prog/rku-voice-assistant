// Tiny fetch wrapper that attaches the admin token and unwraps JSON.
const TOKEN_KEY = "rku_admin_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`/api/admin${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    clearToken();
    window.location.href = "/admin/login";
    throw new Error("Session expired");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: (user, password) => request("/auth/login", { method: "POST", body: { user, password } }),
  me: () => request("/me"),
  stats: () => request("/stats"),
  analytics: () => request("/analytics"),
  leads: () => request("/leads"),
  dialerStatus: () => request("/dialer/status"),
  call: (phone, name) => request("/call", { method: "POST", body: { phone, name } }),
  campaigns: () => request("/campaigns"),
  createCampaign: (name, recipients) =>
    request("/campaigns", { method: "POST", body: { name, recipients } }),
  deleteCampaign: (id) => request(`/campaigns/${id}`, { method: "DELETE" }),
  runCampaign: (id) => request(`/campaigns/${id}/run`, { method: "POST" }),
};

// Server-Sent Events stream for the live monitor (token via query).
export function liveStream() {
  return new EventSource(`/api/admin/live?token=${encodeURIComponent(getToken() || "")}`);
}
