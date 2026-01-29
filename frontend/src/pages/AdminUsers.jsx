import { useEffect, useState } from "react";
import { api } from "../api";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("ATENDENTE");

  async function carregar() {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/users");
      setUsers(data);
    } catch (e) {
      console.error(e);
      alert("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function criar(e) {
    e.preventDefault();
    try {
      await api.post("/admin/users", { username, password, role });
      setUsername("");
      setPassword("");
      setRole("ATENDENTE");
      carregar();
      alert("Usuário criado!");
    } catch (e) {
      console.error(e);
      alert("Erro ao criar usuário");
    }
  }

  return (
    <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
      <h3 style={{ marginTop: 0 }}>Usuários</h3>

      <form onSubmit={criar} style={{ display: "grid", gap: 10, maxWidth: 420 }}>
        <input placeholder="Usuário" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input
          placeholder="Senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="ATENDENTE">ATENDENTE</option>
          <option value="ENTREGADOR">ENTREGADOR</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <button>Cadastrar</button>
      </form>

      <div style={{ marginTop: 12 }}>
        {users.map((u) => (
          <div key={u.id}>
            {u.username} — {u.role}
          </div>
        ))}
      </div>
    </div>
  );
}
