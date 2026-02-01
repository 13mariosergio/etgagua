import { useEffect, useState } from "react";
import { api } from "../api";

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);

  // Formulário
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [pontoReferencia, setPontoReferencia] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");

  // Edição
  const [editando, setEditando] = useState(null);

  async function carregar() {
    setLoading(true);
    try {
      const { data } = await api.get("/clientes");
      setClientes(data);
    } catch (e) {
      console.error(e);
      alert("Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e) {
    e.preventDefault();

    if (!nome || !endereco) {
      return alert("Nome e endereço são obrigatórios");
    }

    try {
      if (editando) {
        await api.patch(`/clientes/${editando.id}`, {
          nome,
          endereco,
          pontoReferencia,
          telefone,
          cpf,
        });
        alert("✅ Cliente atualizado!");
      } else {
        await api.post("/clientes", {
          nome,
          endereco,
          pontoReferencia,
          telefone,
          cpf,
        });
        alert("✅ Cliente cadastrado!");
      }

      limparForm();
      carregar();
    } catch (e) {
      console.error(e);
      alert("❌ Erro ao salvar cliente");
    }
  }

  function limparForm() {
    setNome("");
    setEndereco("");
    setPontoReferencia("");
    setTelefone("");
    setCpf("");
    setEditando(null);
  }

  function editar(cliente) {
    setEditando(cliente);
    setNome(cliente.nome);
    setEndereco(cliente.endereco);
    setPontoReferencia(cliente.pontoReferencia || "");
    setTelefone(cliente.telefone || "");
    setCpf(cliente.cpf || "");
  }

  async function excluir(id) {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;

    try {
      await api.delete(`/clientes/${id}`);
      alert("✅ Cliente excluído!");
      carregar();
    } catch (e) {
      console.error(e);
      alert("❌ Erro ao excluir cliente");
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h2 style={{ margin: 0, color: "#1e40af" }}>📋 Cadastro de Clientes - ÁGUA FCOELHO</h2>

      {/* Formulário */}
      <div
        style={{
          padding: 16,
          border: "2px solid #1e40af",
          borderRadius: 12,
          background: "rgba(30, 64, 175, 0.05)",
        }}
      >
        <h3 style={{ marginTop: 0, color: "#1e40af" }}>
          {editando ? "✏️ Editar Cliente" : "➕ Novo Cliente"}
        </h3>

        <form onSubmit={salvar} style={{ display: "grid", gap: 12, maxWidth: 600 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 14, fontWeight: 700, color: "#1e40af" }}>
              Nome do Cliente *
            </label>
            <input
              placeholder="Ex: João Silva"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              style={{
                padding: 12,
                borderRadius: 8,
                border: "2px solid #3b82f6",
                fontSize: 16,
              }}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 14, fontWeight: 700, color: "#1e40af" }}>
              Endereço *
            </label>
            <input
              placeholder="Ex: Rua das Flores, 123"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              required
              style={{
                padding: 12,
                borderRadius: 8,
                border: "2px solid #3b82f6",
                fontSize: 16,
              }}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 14, fontWeight: 700, color: "#1e40af" }}>
              Ponto de Referência
            </label>
            <input
              placeholder="Ex: Próximo ao mercado"
              value={pontoReferencia}
              onChange={(e) => setPontoReferencia(e.target.value)}
              style={{
                padding: 12,
                borderRadius: 8,
                border: "2px solid #3b82f6",
                fontSize: 16,
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 14, fontWeight: 700, color: "#1e40af" }}>
                Telefone
              </label>
              <input
                placeholder="(85) 99999-9999"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: "2px solid #3b82f6",
                  fontSize: 16,
                }}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 14, fontWeight: 700, color: "#1e40af" }}>CPF</label>
              <input
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: "2px solid #3b82f6",
                  fontSize: 16,
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button
              type="submit"
              className="btn success"
              style={{
                padding: "12px 24px",
                fontSize: 16,
                fontWeight: 700,
                background: "#10b981",
                border: "none",
                borderRadius: 8,
                color: "white",
                cursor: "pointer",
              }}
            >
              {editando ? "💾 Atualizar" : "✅ Salvar"}
            </button>
            {editando && (
              <button
                type="button"
                onClick={limparForm}
                className="btn secondary"
                style={{
                  padding: "12px 24px",
                  fontSize: 16,
                  fontWeight: 700,
                  background: "#6b7280",
                  border: "none",
                  borderRadius: 8,
                  color: "white",
                  cursor: "pointer",
                }}
              >
                ❌ Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Lista */}
      <div
        style={{
          padding: 16,
          border: "2px solid #1e40af",
          borderRadius: 12,
          background: "rgba(30, 64, 175, 0.03)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 16,
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0, color: "#1e40af" }}>👥 Clientes Cadastrados</h3>
          <button
            onClick={carregar}
            disabled={loading}
            style={{
              padding: "10px 16px",
              background: "#3b82f6",
              border: "none",
              borderRadius: 8,
              color: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {loading ? "⏳ Atualizando..." : "🔄 Atualizar"}
          </button>
        </div>

        {clientes.length === 0 ? (
          <p style={{ textAlign: "center", opacity: 0.7 }}>
            Nenhum cliente cadastrado ainda.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {clientes.map((c) => (
              <div
                key={c.id}
                style={{
                  padding: 16,
                  border: "2px solid rgba(30, 64, 175, 0.3)",
                  borderRadius: 10,
                  background: "rgba(30, 64, 175, 0.05)",
                  display: "grid",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "start",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 20, fontWeight: "bold", color: "#1e40af" }}>
                      {c.nome}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.7,
                        marginTop: 4,
                        background: "#dbeafe",
                        padding: "4px 8px",
                        borderRadius: 6,
                        display: "inline-block",
                        color: "#1e40af",
                        fontWeight: 700,
                      }}
                    >
                      Código: {c.codigo}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => editar(c)}
                      style={{
                        padding: "8px 16px",
                        background: "#3b82f6",
                        border: "none",
                        borderRadius: 8,
                        color: "white",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => excluir(c.id)}
                      style={{
                        padding: "8px 16px",
                        background: "#ef4444",
                        border: "none",
                        borderRadius: 8,
                        color: "white",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      🗑️ Excluir
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: 15, color: "#374151" }}>📍 {c.endereco}</div>
                {c.pontoReferencia && (
                  <div style={{ fontSize: 14, color: "#6b7280" }}>
                    🗺️ {c.pontoReferencia}
                  </div>
                )}
                {c.telefone && (
                  <div style={{ fontSize: 14, color: "#6b7280" }}>📞 {c.telefone}</div>
                )}
                {c.cpf && (
                  <div style={{ fontSize: 14, color: "#6b7280" }}>🆔 {c.cpf}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
