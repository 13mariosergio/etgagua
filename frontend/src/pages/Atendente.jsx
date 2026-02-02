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
  const [pontoReferencia, setPontoReferencia] = useState(""); // 🆕 NOVO CAMPO
  const [observacao, setObservacao] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("DINHEIRO");
  const [produtos, setProdutos] = useState([]);
  const [produtoId, setProdutoId] = useState("");
  const [qtd, setQtd] = useState(1);
  const [itens, setItens] = useState([]);
  const [trocoPara, setTrocoPara] = useState("");
  const [salvando, setSalvando] = useState(false);

  // AUTOCOMPLETE DE CLIENTES
  const [clientes, setClientes] = useState([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [clientesFiltrados, setClientesFiltrados] = useState([]);

  async function carregarProdutos() {
    try {
      const { data } = await api.get("/produtos");
      const lista = Array.isArray(data) ? data : [];
      setProdutos(lista);
      if (lista.length && !produtoId) setProdutoId(String(lista[0].id));
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || "Erro ao carregar produtos.");
    }
  }

  async function carregarClientes() {
    try {
      const { data } = await api.get("/clientes");
      setClientes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    carregarProdutos();
    carregarClientes();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (clienteNome.length >= 2) {
      const filtrados = clientes.filter(c =>
        c.nome.toLowerCase().includes(clienteNome.toLowerCase())
      );
      setClientesFiltrados(filtrados);
      setMostrarSugestoes(filtrados.length > 0);
    } else {
      setClientesFiltrados([]);
      setMostrarSugestoes(false);
    }
  }, [clienteNome, clientes]);

  function selecionarCliente(cliente) {
    setClienteNome(cliente.nome);
    setEndereco(cliente.endereco);
    setTelefone(cliente.telefone || "");
    setPontoReferencia(cliente.pontoreferencia || ""); // 🆕 PREENCHE PONTO DE REFERÊNCIA
    setMostrarSugestoes(false);
  }

  const totalPreviewCentavos = useMemo(() => {
    if (!Array.isArray(produtos) || produtos.length === 0) return 0;
    if (!Array.isArray(itens) || itens.length === 0) return 0;

    let total = 0;

    for (const item of itens) {
      const produtoId = Number(item.produtoId);
      const produto = produtos.find(p => Number(p.id) === produtoId);

      if (produto) {
        const preco = Number(produto.precoCentavos);
        const quantidade = Number(item.qtd);
        
        if (!isNaN(preco) && !isNaN(quantidade)) {
          total += preco * quantidade;
        }
      }
    }

    return total;
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
      const idx = prev.findIndex((x) => Number(x.produtoId) === Number(produtoId));
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

    const totalReais = (totalPreviewCentavos / 100).toFixed(2);
    const trocoReais = (trocoPreviewCentavos / 100).toFixed(2);
    const trocoParaReais = tpc ? (tpc / 100).toFixed(2) : "0.00";

    let mensagem = `📋 RESUMO DO PEDIDO\n\n`;
    mensagem += `Cliente: ${clienteNome}\n`;
    mensagem += `Endereço: ${endereco}\n`;
    if (pontoReferencia) mensagem += `Ponto de referência: ${pontoReferencia}\n`; // 🆕
    mensagem += `\n💰 VALORES:\n`;
    mensagem += `Total: R$ ${totalReais}\n`;

    if (formaPagamento === "DINHEIRO" && tpc) {
      mensagem += `Troco para: R$ ${trocoParaReais}\n`;
      mensagem += `Troco: R$ ${trocoReais}\n`;
    }

    mensagem += `\nForma de pagamento: ${formaPagamento}\n\n`;
    mensagem += `Deseja confirmar o pedido?`;

    if (!confirm(mensagem)) return;

    setSalvando(true);
    try {
      await api.post("/pedidos", {
        clienteNome,
        telefone,
        endereco,
        observacao: pontoReferencia ? `${pontoReferencia}${observacao ? ' | ' + observacao : ''}` : observacao, // 🆕 COMBINA PONTO REF + OBS
        itens,
        formaPagamento,
        trocoParaCentavos: tpc,
      });

      alert(`✅ PEDIDO CRIADO!\n\nTotal: R$ ${totalReais}${formaPagamento === "DINHEIRO" && tpc ? `\nTroco: R$ ${trocoReais}` : ''}`);

      setClienteNome("");
      setTelefone("");
      setEndereco("");
      setPontoReferencia(""); // 🆕
      setObservacao("");
      setItens([]);
      setQtd(1);
      setTrocoPara("");
      setFormaPagamento("DINHEIRO");
    } catch (err) {
      console.error(err);
      alert("❌ Erro: " + (err?.response?.data?.error || "Erro desconhecido"));
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
          {/* CAMPO COM AUTOCOMPLETE */}
          <div style={{ position: "relative" }}>
            <input
              placeholder="Nome do cliente * (digite para buscar)"
              value={clienteNome}
              onChange={(e) => setClienteNome(e.target.value)}
              onFocus={() => clienteNome.length >= 2 && setMostrarSugestoes(true)}
              required
              autoComplete="off"
            />
            
            {/* LISTA DE SUGESTÕES */}
            {mostrarSugestoes && clientesFiltrados.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  background: "#1e293b",
                  border: "1px solid #3b82f6",
                  borderRadius: 8,
                  maxHeight: 200,
                  overflowY: "auto",
                  zIndex: 1000,
                  marginTop: 4,
                  boxShadow: "0 4px 6px rgba(0,0,0,0.3)"
                }}
              >
                {clientesFiltrados.map((cliente) => (
                  <div
                    key={cliente.id}
                    onClick={() => selecionarCliente(cliente)}
                    style={{
                      padding: 12,
                      cursor: "pointer",
                      borderBottom: "1px solid rgba(255,255,255,0.1)",
                      transition: "background 0.2s"
                    }}
                    onMouseEnter={(e) => e.target.style.background = "rgba(59, 130, 246, 0.2)"}
                    onMouseLeave={(e) => e.target.style.background = "transparent"}
                  >
                    <div style={{ fontWeight: 700, color: "#3b82f6" }}>{cliente.nome}</div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                      📍 {cliente.endereco}
                    </div>
                    {cliente.pontoreferencia && (
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        🗺️ {cliente.pontoreferencia}
                      </div>
                    )}
                    {cliente.telefone && (
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        📞 {cliente.telefone}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <input placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          <input placeholder="Endereço *" value={endereco} onChange={(e) => setEndereco(e.target.value)} required />
          
          {/* 🆕 CAMPO PONTO DE REFERÊNCIA */}
          <input 
            placeholder="Ponto de referência (ex: Próximo ao mercado)" 
            value={pontoReferencia} 
            onChange={(e) => setPontoReferencia(e.target.value)} 
          />
          
          <input placeholder="Observação adicional" value={observacao} onChange={(e) => setObservacao(e.target.value)} />

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
            <button type="button" onClick={carregarProdutos} className="btn secondary">Atualizar produtos</button>
          </div>

          {itens.length > 0 && (
            <div style={{ marginTop: 8, padding: 12, border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10 }}>
              <b>Itens</b>
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                {itens.map((it) => {
                  const p = produtos.find((x) => Number(x.id) === Number(it.produtoId));
                  const nomeP = p ? p.nome : `Produto #${it.produtoId}`;
                  const unit = p ? p.precoCentavos : 0;
                  const sub = unit * it.qtd;

                  return (
                    <div key={it.produtoId} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <span>
                        {it.qtd}x {nomeP} (R$ {centavosToReais(unit)} un) — <b style={{ color: '#10b981' }}>R$ {centavosToReais(sub)}</b>
                      </span>
                      <button type="button" onClick={() => removerItem(it.produtoId)} className="btn danger" style={{ padding: '8px 16px' }}>Remover</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
            {formaPagamento === "DINHEIRO" && (
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 12, opacity: 0.7 }}>Troco pra quanto? (R$)</label>
                <input value={trocoPara} onChange={(e) => setTrocoPara(e.target.value)} placeholder="Ex: 50,00" style={{ padding: 8, width: 160 }} />
              </div>
            )}

            <div style={{ padding: 16, border: "2px solid rgba(59, 130, 246, 0.3)", borderRadius: 12, backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
              <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>
                Total: <span style={{ color: '#10b981' }}>R$ {(totalPreviewCentavos / 100).toFixed(2)}</span>
              </div>
              {formaPagamento === "DINHEIRO" && trocoParaCentavos > 0 && (
                <>
                  <div style={{ fontSize: 16, marginTop: 6 }}>
                    Troco para: <span style={{ color: '#3b82f6', fontWeight: 600 }}>R$ {(trocoParaCentavos / 100).toFixed(2)}</span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 'bold', marginTop: 4 }}>
                    Troco: <span style={{ color: '#f59e0b' }}>R$ {(trocoPreviewCentavos / 100).toFixed(2)}</span>
                  </div>
                </>
              )}
              <div style={{ opacity: 0.75, marginTop: 10, fontSize: 14, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}>
                💳 <b>{formaPagamento === "DINHEIRO" ? "Dinheiro" : formaPagamento === "PIX" ? "Pix" : "Cartão"}</b>
              </div>
            </div>
          </div>

          <button type="submit" disabled={salvando} className="btn success" style={{ justifySelf: "start", fontSize: 18, padding: '14px 28px' }}>
            {salvando ? "⏳ Salvando..." : "✅ Criar pedido"}
          </button>
        </form>
      </div>

      <Pedidos modo="ATENDENTE" />
    </div>
  );
}