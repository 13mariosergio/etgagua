import { useEffect, useState } from "react";
import { api } from "./api";
import "./App.css";

const statusOptions = ["ABERTO", "EM_ROTA", "ENTREGUE", "CANCELADO"];

export default function App() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(false);

  const [clienteNome, setClienteNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [observacao, setObservacao] = useState("");

  async function carregarPedidos() {
    setLoading(true);
    try {
      const { data } = await api.get("/pedidos");
      setPedidos(data);
    } catch (e) {
      alert("Erro ao carregar pedidos. Veja o console.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarPedidos();
  }, []);

  async function criarPedido(e) {
    e.preventDefault();
    try {
      const { data } = await api.post("/pedidos", {
        clienteNome,
        telefone,
        endereco,
        observacao,
      });
      setClienteNome("");
      setTelefone("");
      setEndereco("");
      setObservacao("");
      setPedidos((prev) => [data, ...prev]);
    } catch (e2) {
      const msg = e2?.response?.data?.error || "Erro ao criar pedido.";
      alert(msg);
      console.error(e2);
    }
  }

  async function mudarStatus(id, status) {
    try {
      const { data } = await api.patch(`/pedidos/${id}/status`, { status });
      setPedidos((prev) => prev.map((p) => (p.id === id ? data : p)));
    } catch (e) {
      alert("Erro ao atualizar status.");
      console.error(e);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>ETGÁGUA</h1>
      <p style={{ opacity: 0.7, marginTop: -8 }}>
        Painel simples (React + Vite) conectado no Backend (Node + SQLite)
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
          <h2 style={{ marginTop: 0 }}>Criar pedido</h2>

          <form onSubmit={criarPedido} style={{ display: "grid", gap: 10 }}>
            <input
              placeholder="Nome do cliente *"
              value={clienteNome}
              onChange={(e) => setClienteNome(e.target.value)}
              required
            />
            <input
              placeholder="Telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
            />
            <input
              placeholder="Endereço *"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              required
            />
            <input
              placeholder="Observação"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
            <button type="submit">Salvar</button>
          </form>
        </div>

        <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ marginTop: 0 }}>Pedidos</h2>
            <button onClick={carregarPedidos} disabled={loading}>
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>

          {pedidos.length === 0 ? (
            <p>Nenhum pedido ainda.</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {pedidos.map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: 12,
                    border: "1px solid #eee",
                    borderRadius: 12,
                    background: "#fafafa",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <strong>#{p.id}</strong> — <strong>{p.clienteNome}</strong>
                      <div style={{ opacity: 0.8, marginTop: 4 }}>{p.endereco}</div>
                      {p.telefone ? <div style={{ opacity: 0.8 }}>📞 {p.telefone}</div> : null}
                      {p.observacao ? <div style={{ opacity: 0.8 }}>📝 {p.observacao}</div> : null}
                      <div style={{ opacity: 0.6, marginTop: 6 }}>Criado em: {p.criadoEm}</div>
                    </div>

                    <div style={{ minWidth: 180 }}>
                      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Status</div>
                      <select
                        value={p.status}
                        onChange={(e) => mudarStatus(p.id, e.target.value)}
                        style={{ width: "100%", padding: 8 }}
                      >
                        {statusOptions.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
