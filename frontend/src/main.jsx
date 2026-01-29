import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";


import { AuthProvider } from "./auth/AuthContext";
import { RequireAuth, RequireRole } from "./auth/RequireAuth";

import Layout from "./components/Layout";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import Atendente from "./pages/Atendente";
import Entregador from "./pages/Entregador";
import Relatorios from "./pages/Relatorios";


import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />

            <Route
              path="/admin"
              element={
                <RequireRole allow={["ADMIN"]}>
                  <Admin />
                </RequireRole>
              }
              
            />
               <Route
                path="/relatorios"
                element={
                  <RequireRole allow={["ADMIN"]}>
                    <Relatorios />
                  </RequireRole>
                }
              />

            <Route
              path="/atendente"
              element={
                <RequireRole allow={["ATENDENTE", "ADMIN"]}>
                  <Atendente />
                </RequireRole>
              }
            />

            <Route
              path="/entregador"
              element={
                <RequireRole allow={["ENTREGADOR", "ADMIN"]}>
                  <Entregador />
                </RequireRole>
              }
                

            />

            

            {/* qualquer rota desconhecida */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
