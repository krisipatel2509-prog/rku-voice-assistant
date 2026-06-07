import { createContext, useContext, useState } from "react";
import { api, getToken, setToken, clearToken } from "./api.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [authed, setAuthed] = useState(Boolean(getToken()));

  async function login(user, password) {
    const { token } = await api.login(user, password);
    setToken(token);
    setAuthed(true);
  }

  function logout() {
    clearToken();
    setAuthed(false);
  }

  return <AuthCtx.Provider value={{ authed, login, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
