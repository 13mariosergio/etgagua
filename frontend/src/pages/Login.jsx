import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(username, password);

      // redireciona por perfil
      if (u.role === "ADMIN") nav("/admin", { replace: true });
      else if (u.role === "ATENDENTE") nav("/atendente", { replace: true });
      else nav("/entregador", { replace: true });
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error || "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
      <h2 style={{ marginTop: 0 }}>Entrar</h2>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <input placeholder="Usuário" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <input
          placeholder="Senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p style={{ marginTop: 12, opacity: 0.7, fontSize: 12 }}>
        Admin inicial: <b>admin</b> / <b>admin123</b>
      </p>
    </div>
  );
}
