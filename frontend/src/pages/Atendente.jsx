import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import Pedidos from "./Pedidos";

function reaisToCentavos(v) {
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function centavosToReais(c) {
  const n = Number(c || 0) / 100;
  return n.toFixed(2);
}

export default function Atendente() {
  const [clienteNome, setClienteNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [observacao, setObservacao] = useState("");

  const [formaPagamento, setFormaPagamento] = useState("DINHEIRO"); // DINHEIRO | PIX | CARTAO

  const [produtos, setProdutos] = useState([]);
  const [produtoId, setProdutoId] = useState("");
  const [qtd, setQtd] = useState(1);
  const [itens, setItens] = useState([]);

  const [trocoPara, setTrocoPara] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function carregarProdutos() {
    try {
      const { data } = await api.get("/produtos"); // interceptor injeta token
      const lista = Array.isArray(data) ? data : [];
      setProdutos(lista);
      if (lista.length && !produtoId) setProdutoId(String(lista[0].id));
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || "Erro ao carregar produtos.");
    }
  }

  useEffect(() => {
    carregarProdutos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPreviewCentavos = useMemo(() => {
    const map = new Map(produtos.map((p) => [String(p.id), p]));
    return itens.reduce((acc, it) => {
      const p = map.get(String(it.produtoId));
      const unit = p ? Number(p.precoCentavos || 0) : 0;
      return acc + unit * it.qtd;
    }, 0);
  }, [itens, produtos]);

  const trocoParaCentavos = useMemo(() => {
    if (formaPagamento !== "DINHEIRO") return null;
    if (!trocoPara) return null;
    return reaisToCentavos(trocoPara);
  }, [trocoPara, formaPagamento]);

  const trocoPreviewCentavos = useMemo(() => {
    if (formaPagamento !== "DINHEIRO") return 0;
    if (trocoParaCentavos === null) return 0;
    return Math.max(0, trocoParaCentavos - totalPreviewCentavos);
  }, [trocoParaCentavos, totalPreviewCentavos, formaPagamento]);

  useEffect(() => {
    if (formaPagamento !== "DINHEIRO") setTrocoPara("");
  }, [formaPagamento]);

  function addItem() {
    if (!produtoId) return;
    const q = Number(qtd);
    if (!Number.isInteger(q) || q <= 0) return alert("Quantidade inválida");

    setItens((prev) => {
      const idx = prev.findIndex((x) => String(x.produtoId) === String(produtoId));
      if (idx >= 0) {
        const cp = [...prev];
        cp[idx] = { ...cp[idx], qtd: cp[idx].qtd + q };
        return cp;
      }
      return [...prev, { produtoId: Number(produtoId), qtd: q }];
    });
  }

  function removerItem(pid) {
    setItens((prev) => prev.filter((x) => x.produtoId !== pid));
  }

  async function criarPedido(e) {
    e.preventDefault();

    if (!clienteNome || !endereco) return alert("Nome e endereço são obrigatórios.");
    if (!itens.length) return alert("Adicione pelo menos 1 item.");

    const tpc = trocoParaCentavos;
    if (formaPagamento === "DINHEIRO" && tpc !== null && tpc < totalPreviewCentavos) {
      return alert("Troco pra quanto deve ser maior ou igual ao total.");
    }

    setSalvando(true);
    try {
      await api.post("/pedidos", {
        clienteNome,
        telefone,
        endereco,
        observacao,
        itens,
        formaPagamento,
        trocoParaCentavos: tpc,
      });

      setClienteNome("");
      setTelefone("");
      setEndereco("");
      setObservacao("");
      setItens([]);
      setQtd(1);
      setTrocoPara("");
      setFormaPagamento("DINHEIRO");

      alert("Pedido criado!");
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error || "Erro ao criar pedido.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0 }}>Atendente</h2>
      <p style={{ marginTop: -6, opacity: 0.75 }}>
        Crie pedido com itens + total + troco (dinheiro) + forma de pagamento.
      </p>

      <div style={{ padding: 16, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 }}>
        <h3 style={{ marginTop: 0 }}>Novo pedido</h3>

        <form onSubmit={criarPedido} style={{ display: "grid", gap: 10 }}>
          <input placeholder="Nome do cliente *" value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} required />
          <input placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          <input placeholder="Endereço *" value={endereco} onChange={(e) => setEndereco(e.target.value)} required />
          <input placeholder="Observação" value={observacao} onChange={(e) => setObservacao(e.target.value)} />

          <div style={{ display: "grid", gap: 6, maxWidth: 320 }}>
            <label style={{ fontSize: 12, opacity: 0.7 }}>Forma de pagamento</label>
            <select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} style={{ padding: 8 }}>
              <option value="DINHEIRO">Dinheiro</option>
              <option value="PIX">Pix</option>
              <option value="CARTAO">Cartão</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
            <div style={{ display: "grid", gap: 6, flex: "1 1 260px", minWidth: 220 }}>
              <label style={{ fontSize: 12, opacity: 0.7 }}>Produto</label>
              <select value={produtoId} onChange={(e) => setProdutoId(e.target.value)} style={{ padding: 8, width: "100%" }}>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} — R$ {centavosToReais(p.precoCentavos)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 12, opacity: 0.7 }}>Qtd</label>
              <input type="number" value={qtd} onChange={(e) => setQtd(e.target.value)} min="1" style={{ padding: 8, width: 90 }} />
            </div>

            <button type="button" onClick={addItem} className="btn">Adicionar item</button>
            <button type="button" onClick={carregarProdutos} className="btn">Atualizar produtos</button>
          </div>

          {itens.length ? (
            <div style={{ marginTop: 8, padding: 12, border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10 }}>
              <b>Itens</b>
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                {itens.map((it) => {
                  const p = produtos.find((x) => x.id === it.produtoId);
                  const nomeP = p ? p.nome : `Produto #${it.produtoId}`;
                  const unit = p ? p.precoCentavos : 0;
                  const sub = unit * it.qtd;

                  return (
                    <div key={it.produtoId} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <span>
                        {it.qtd}x {nomeP} (R$ {centavosToReais(unit)} un) — <b>R$ {centavosToReais(sub)}</b>
                      </span>
                      <button type="button" onClick={() => removerItem(it.produtoId)} className="btn">Remover</button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
            {formaPagamento === "DINHEIRO" ? (
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 12, opacity: 0.7 }}>Troco pra quanto? (R$)</label>
                <input value={trocoPara} onChange={(e) => setTrocoPara(e.target.value)} placeholder="Ex: 50,00" style={{ padding: 8, width: 160 }} />
              </div>
            ) : (
              <div style={{ opacity: 0.7, fontSize: 12 }}>Troco apenas para <b>Dinheiro</b>.</div>
            )}

            <div style={{ padding: 10, border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10 }}>
              <div style={{ opacity: 0.85 }}>Total (preview): <b>R$ {centavosToReais(totalPreviewCentavos)}</b></div>
              <div style={{ opacity: 0.85 }}>Troco (preview): <b>R$ {centavosToReais(trocoPreviewCentavos)}</b></div>
              <div style={{ opacity: 0.75, marginTop: 4, fontSize: 12 }}>
                Pagamento: <b>{formaPagamento === "DINHEIRO" ? "Dinheiro" : formaPagamento === "PIX" ? "Pix" : "Cartão"}</b>
              </div>
            </div>
          </div>

          <button type="submit" disabled={salvando} className="btn" style={{ justifySelf: "start" }}>
            {salvando ? "Salvando..." : "Criar pedido"}
          </button>
        </form>
      </div>

      <Pedidos modo="ATENDENTE" />
    </div>
  );
}
