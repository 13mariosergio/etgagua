import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

// Garante que existe usuário logado
export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

// Garante que o role do usuário está permitido
export function RequireRole({ allow = [], children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allow.length && !allow.includes(user.role)) {
    // Se não tiver permissão, manda para a tela correta do próprio perfil
    const home =
      user.role === "ADMIN" ? "/admin" :
      user.role === "ATENDENTE" ? "/atendente" :
      user.role === "ENTREGADOR" ? "/entregador" :
      "/login";

    return <Navigate to={home} replace />;
  }

  return children;
}
