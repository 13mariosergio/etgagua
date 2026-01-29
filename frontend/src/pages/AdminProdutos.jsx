import { useEffect, useState } from "react";
import { api } from "../api";

export default function AdminProdutos() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(false);

  // formulário
  const [nome, setNome] = useState("");
  const [volumeMl, setVolumeMl] = useState("");
  const [tipo, setTipo] = useState("AGUA");
  const [preco, setPreco] = useState("");

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
    try {
      await api.post("/admin/produtos", {
        nome,
        volumeMl: volumeMl ? Number(volumeMl) : null,
        tipo,
        precoCentavos: Math.round(Number(preco || 0) * 100),
      });

      setNome("");
      setVolumeMl("");
      setTipo("AGUA");
      setPreco("");

      carregar();
      alert("Produto cadastrado!");
    } catch (e) {
      console.error(e);
      alert("Erro ao cadastrar produto");
    }
  }

  async function atualizar(produto, campos) {
    try {
      await api.patch(`/admin/produtos/${produto.id}`, campos);
      carregar();
    } catch (e) {
      console.error(e);
      alert("Erro ao atualizar produto");
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h2 style={{ margin: 0 }}>Produtos / Águas</h2>

      {/* Cadastro */}
      <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
        <h3 style={{ marginTop: 0 }}>Cadastrar novo produto</h3>

        <form onSubmit={criarProduto} style={{ display: "grid", gap: 10, maxWidth: 420 }}>
          <input
            placeholder="Nome (ex: Galão 20L)"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />

          <input
            placeholder="Volume em ml (opcional)"
            value={volumeMl}
            onChange={(e) => setVolumeMl(e.target.value)}
            type="number"
          />

          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="AGUA">Água</option>
            <option value="VASILHAME">Vasilhame</option>
            <option value="COMBO">Vasilhame + Água</option>
            <option value="OUTRO">Outro</option>
          </select>

          <input
            placeholder="Preço (R$)"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            type="number"
            step="0.01"
          />

          <button type="submit">Cadastrar</button>
        </form>
      </div>

      {/* Lista */}
      <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ marginTop: 0 }}>Produtos cadastrados</h3>
          <button onClick={carregar} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        {produtos.length === 0 ? (
          <p>Nenhum produto.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {produtos.map((p) => (
              <div
                key={p.id}
                style={{
                  padding: 12,
                  border: "1px solid #eee",
                  borderRadius: 10,
                  display: "grid",
                  gap: 6,
                }}
              >
                <b>{p.nome}</b>
                <div>Tipo: {p.tipo}</div>
                {p.volumeMl ? <div>Volume: {p.volumeMl} ml</div> : null}

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span>Preço:</span>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={(p.precoCentavos / 100).toFixed(2)}
                    onBlur={(e) =>
                      atualizar(p, { precoCentavos: Math.round(Number(e.target.value) * 100) })
                    }
                  />
                </div>

                <label>
                  <input
                    type="checkbox"
                    checked={p.ativo === 1}
                    onChange={(e) => atualizar(p, { ativo: e.target.checked })}
                  />{" "}
                  Ativo
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
