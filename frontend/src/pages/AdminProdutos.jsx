import { useEffect, useState } from "react";
import { api } from "../api";

export default function AdminProdutos() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(false);

  // Formulário de cadastro
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");

  // Modal de edição
  const [editando, setEditando] = useState(null);
  const [editNome, setEditNome] = useState("");
  const [editPreco, setEditPreco] = useState("");

  async function carregar() {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/produtos");
      setProdutos(data);
    } catch (e) {
      console.error(e);
      alert("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function criarProduto(e) {
    e.preventDefault();
    
    if (!nome.trim()) {
      return alert("Nome é obrigatório");
    }

    try {
      await api.post("/admin/produtos", {
        nome: nome.trim(),
        precoCentavos: Math.round(Number(preco || 0) * 100),
      });

      setNome("");
      setPreco("");
      carregar();
      alert("✅ Produto cadastrado!");
    } catch (e) {
      console.error(e);
      alert("❌ Erro ao cadastrar produto");
    }
  }

  function abrirEdicao(produto) {
    setEditando(produto);
    setEditNome(produto.nome);
    setEditPreco((produto.precocentavos / 100).toFixed(2));
  }

  function fecharEdicao() {
    setEditando(null);
    setEditNome("");
    setEditPreco("");
  }

  async function salvarEdicao(e) {
    e.preventDefault();

    if (!editNome.trim()) {
      return alert("Nome é obrigatório");
    }

    try {
      await api.patch(`/admin/produtos/${editando.id}`, {
        nome: editNome.trim(),
        precoCentavos: Math.round(Number(editPreco || 0) * 100),
      });

      carregar();
      fecharEdicao();
      alert("✅ Produto atualizado!");
    } catch (e) {
      console.error(e);
      alert("❌ Erro ao atualizar produto");
    }
  }

  async function removerProduto(produto) {
    if (!confirm(`Tem certeza que deseja remover "${produto.nome}"?`)) return;

    try {
      // Como não temos rota DELETE, vamos desativar permanentemente
      await api.patch(`/admin/produtos/${produto.id}`, {
        nome: `[REMOVIDO] ${produto.nome}`,
        ativo: 0,
      });
      carregar();
      alert("✅ Produto removido!");
    } catch (e) {
      console.error(e);
      alert("❌ Erro ao remover produto");
    }
  }

  async function toggleAtivo(produto, e) {
    e.preventDefault();
    
    try {
      // O checkbox retorna true/false, mas o backend espera 0 ou 1
      const novoAtivo = e.target.checked ? 1 : 0;
      
      await api.patch(`/admin/produtos/${produto.id}`, {
        ativo: novoAtivo,
      });
      
      // Atualizar localmente para feedback imediato
      setProdutos(prev => prev.map(p => 
        p.id === produto.id ? { ...p, ativo: novoAtivo } : p
      ));
    } catch (err) {
      console.error(err);
      alert("❌ Erro ao atualizar status");
      carregar(); // Recarregar em caso de erro
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h2 style={{ margin: 0 }}>Produtos / Águas</h2>

      {/* Cadastro */}
      <div style={{ padding: 16, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 }}>
        <h3 style={{ marginTop: 0 }}>Cadastrar novo produto</h3>

        <form onSubmit={criarProduto} style={{ display: "grid", gap: 10, maxWidth: 420 }}>
          <input
            placeholder="Nome (ex: Vasilhame 20L + água)"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />

          <input
            placeholder="Preço (R$)"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            type="number"
            step="0.01"
            min="0"
          />

          <button type="submit" className="btn success">Cadastrar Produto</button>
        </form>
      </div>

      {/* Lista */}
      <div style={{ padding: 16, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Produtos cadastrados</h3>
          <button onClick={carregar} disabled={loading} className="btn secondary">
            {loading ? "⏳ Atualizando..." : "🔄 Atualizar"}
          </button>
        </div>

        {produtos.length === 0 ? (
          <p style={{ opacity: 0.7 }}>Nenhum produto cadastrado.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {produtos.map((p) => {
              const isAtivo = p.ativo === 1 || p.ativo === true;
              
              {produtos.length === 0 ? (
  <p style={{ opacity: 0.7 }}>Nenhum produto cadastrado.</p>
) : (
  <div style={{ display: "grid", gap: 12 }}>
    {produtos
      .filter(p => !p.nome.startsWith('[REMOVIDO]'))
      .map((p) => {
        const isAtivo = p.ativo === 1 || p.ativo === true;
        
        return (
          <div
            key={p.id}
            style={{
              padding: 16,
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              backgroundColor: isAtivo ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
            }}
          >
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 4 }}>
                {p.nome}
              </div>
              <div style={{ fontSize: 16, color: '#10b981' }}>
                R$ {(p.precocentavos / 100).toFixed(2)}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8, 
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: 8,
                backgroundColor: isAtivo ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                border: `2px solid ${isAtivo ? '#10b981' : '#ef4444'}`,
              }}>
                <input
                  type="checkbox"
                  checked={isAtivo}
                  onChange={(e) => toggleAtivo(p, e)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  {isAtivo ? '✅ Ativo' : '❌ Inativo'}
                </span>
              </label>

              <button 
                onClick={() => abrirEdicao(p)} 
                className="btn"
                style={{ padding: '8px 16px' }}
              >
                ✏️ Editar
              </button>

              <button 
                onClick={() => removerProduto(p)} 
                className="btn danger"
                style={{ padding: '8px 16px' }}
              >
                🗑️ Remover
              </button>
            </div>
          </div>
        );
      })}
  </div>
)}
        )}
      </div>

      {/* Modal de Edição */}
      {editando && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
          onClick={fecharEdicao}
        >
          <div
            style={{
              backgroundColor: "var(--bg-card)",
              padding: 24,
              borderRadius: 16,
              maxWidth: 500,
              width: "100%",
              border: "2px solid var(--primary)",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: 20 }}>Editar Produto</h3>

            <form onSubmit={salvarEdicao} style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 14, opacity: 0.8 }}>Nome do Produto</label>
                <input
                  placeholder="Nome"
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 14, opacity: 0.8 }}>Preço (R$)</label>
                <input
                  placeholder="0.00"
                  value={editPreco}
                  onChange={(e) => setEditPreco(e.target.value)}
                  type="number"
                  step="0.01"
                  min="0"
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn success" style={{ flex: 1 }}>
                  💾 Salvar
                </button>
                <button type="button" onClick={fecharEdicao} className="btn secondary" style={{ flex: 1 }}>
                  ❌ Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}