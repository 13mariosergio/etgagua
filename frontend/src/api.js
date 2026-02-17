import axios from "axios";

// Usa variável de ambiente ou localhost como fallback
const baseURL = import.meta.env.VITE_API_URL || "http://localhost:3333";

export const api = axios.create({
  baseURL,
});

// Sempre injeta o token mais recente antes de cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("etgagua_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  } else if (config.headers?.Authorization) {
    delete config.headers.Authorization;
  }
  return config;
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("etgagua_token");

  console.log("➡️ REQUEST:", {
    url: config.url,
    method: config.method,
    token,
    headers: config.headers,
  });

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

