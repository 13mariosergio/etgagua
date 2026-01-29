/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("etgagua_token") || "");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("etgagua_user");
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    // sempre aplica o token no axios
    if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
    else delete api.defaults.headers.common.Authorization;
  }, [token]);

  async function login(username, password) {
    const { data } = await api.post("/auth/login", { username, password });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("etgagua_token", data.token);
    localStorage.setItem("etgagua_user", JSON.stringify(data.user));
    api.defaults.headers.common.Authorization = `Bearer ${data.token}`;
    return data.user;
  }

  function logout() {
    setToken("");
    setUser(null);
    localStorage.removeItem("etgagua_token");
    localStorage.removeItem("etgagua_user");
    delete api.defaults.headers.common.Authorization;
  }

  const value = useMemo(() => ({ token, user, login, logout }), [token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
