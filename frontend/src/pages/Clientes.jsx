import { useEffect, useState } from "react";
import { api } from "../api";

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [ponto_referencia, setponto_referencia] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
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
    if (!nome || !endereco) return alert("Nome e endereço obrigatórios");

    try {
      if (editando) {
        await api.patch(`/clientes/${editando.id}`, { nome, endereco, ponto_referencia, telefone, cpf });
        alert("✅ Cliente atualizado!");
      } else {
        await api.post("/clientes", { nome, endereco, ponto_referencia, telefone, cpf });
        alert("✅ Cliente cadastrado!");
      }
      limparForm();
      carregar();
    } catch (e) {
      console.error(e);
      alert("❌ Erro ao salvar");
    }
  }

  function limparForm() {
    setNome("");
    setEndereco("");
    setponto_referencia("");
    setTelefone("");
    setCpf("");
    setEditando(null);
  }

  function editar(c) {
    setEditando(c);
    setNome(c.nome);
    setEndereco(c.endereco);
    setponto_referencia(c.ponto_referencia || "");
    setTelefone(c.telefone || "");
    setCpf(c.cpf || "");
  }

  async function excluir(id) {
    if (!confirm("Excluir cliente?")) return;
    try {
      await api.delete(`/clientes/${id}`);
      alert("✅ Cliente excluído!");
      carregar();
    } catch (e) {
      alert("❌ Erro ao excluir");
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h2>📋 Clientes - ÁGUA FCOELHO</h2>

      <div style={{ padding: 16, border: "1px solid #1e40af", borderRadius: 12 }}>
        <h3>{editando ? "Editar Cliente" : "Novo Cliente"}</h3>
        <form onSubmit={salvar} style={{ display: "grid", gap: 10, maxWidth: 600 }}>
          <input placeholder="Nome *" value={nome} onChange={(e) => setNome(e.target.value)} required />
          <input placeholder="Endereço *" value={endereco} onChange={(e) => setEndereco(e.target.value)} required />
          <input placeholder="Ponto de referência" value={ponto_referencia} onChange={(e) => setponto_referencia(e.target.value)} />
          <input placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          <input placeholder="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} />
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" className="btn success">{editando ? "💾 Atualizar" : "✅ Salvar"}</button>
            {editando && <button type="button" onClick={limparForm} className="btn">❌ Cancelar</button>}
          </div>
        </form>
      </div>

      <div style={{ padding: 16, border: "1px solid #1e40af", borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h3>Clientes Cadastrados</h3>
          <button onClick={carregar} disabled={loading}>{loading ? "⏳" : "🔄"} Atualizar</button>
        </div>

        {clientes.length === 0 ? (
          <p>Nenhum cliente cadastrado.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {clientes.map((c) => (
              <div key={c.id} style={{ padding: 14, border: "1px solid #ddd", borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div>
                    <strong style={{ fontSize: 18, color: "#1e40af" }}>{c.nome}</strong>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>Código: {c.codigo}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => editar(c)} className="btn">✏️</button>
                    <button onClick={() => excluir(c.id)} className="btn danger">🗑️</button>
                  </div>
                </div>
                <div>📍 {c.endereco}</div>
                {c.ponto_referencia && <div>🗺️ {c.ponto_referencia}</div>}
                {c.telefone && <div>📞 {c.telefone}</div>}
                {c.cpf && <div>🆔 {c.cpf}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}