import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";

const ALL_STATUS = ["ABERTO", "EM_ROTA", "ENTREGUE", "CANCELADO"];

function centavosToBRL(c) {
  const v = Number(c || 0) / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getCentavos(p, ...keys) {
  for (const k of keys) {
    const v = p?.[k];
    if (v !== null && v !== undefined && v !== "") return Number(v);
  }
  return 0;
}

function formatarHora(createdAt) {
  if (!createdAt) return "-";
  const d = new Date(createdAt);
  d.setHours(d.getHours() - 3);
  return d.toLocaleString("pt-BR");
}

export default function Pedidos({ modo = "GERAL" }) {
  const filtroInicial =
    modo === "ENTREGADOR" ? "TODOS" : modo === "ATENDENTE" ? "ABERTO" : "TODOS";

  const filtroBotoes = useMemo(() => {
    if (modo === "ENTREGADOR")
      return ["TODOS", "ABERTO", "EM_ROTA", "ENTREGUE", "CANCELADO"];
    if (modo === "ATENDENTE")
      return ["ABERTO", "EM_ROTA", "ENTREGUE", "CANCELADO", "TODOS"];
    return ["TODOS", ...ALL_STATUS];
  }, [modo]);

  const statusPermitidosNoSelect = useMemo(() => {
    if (modo === "ENTREGADOR") return ["ABERTO", "EM_ROTA", "ENTREGUE", "CANCELADO"];
    if (modo === "ATENDENTE") return ["ABERTO", "EM_ROTA"];
    return ALL_STATUS;
  }, [modo]);

  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState(filtroInicial);
  const [newOrdersCount, setNewOrdersCount] = useState(0);

  const mountedRef = useRef(true);
  const loadingRef = useRef(false);
  const previousPedidosRef = useRef([]);
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    if (
      modo === "ENTREGADOR" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission();
    }
  }, [modo]);

  const playSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 400;
      oscillator.type = "sine";
      gainNode.gain.setValueAtTime(0.9, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.05, audioContext.currentTime + 0.9);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.9);
    } catch (error) {
      console.log("Erro ao tocar som:", error);
    }
  };

  const vibrate = () => {
    if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
  };

  const showBrowserNotification = (pedido) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("🚚 Novo Pedido!", {
        body: `Cliente: ${pedido.clientenome}\nEndereço: ${pedido.endereco}`,
        icon: "/logo.png",
        tag: `pedido-${pedido.id}`,
        requireInteraction: false,
      });
    }
  };

  async function carregarPedidos(f = filtro, silent = false) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setErro("");

    try {
      const url =
        f && f !== "TODOS" ? `/pedidos?status=${encodeURIComponent(f)}` : "/pedidos";
      const { data } = await api.get(url);
      if (!mountedRef.current) return;

      const novosPedidos = Array.isArray(data) ? data : [];

      if (modo === "ENTREGADOR" && !isFirstLoadRef.current && !silent) {
        const pedidosAntigos = previousPedidosRef.current || [];
        const idsAntigos = new Set(pedidosAntigos.map((p) => p.id));
        const pedidosRealmenteNovos = novosPedidos.filter((p) => !idsAntigos.has(p.id));

        if (pedidosRealmenteNovos.length > 0) {
          playSound();
          vibrate();
          setNewOrdersCount((prev) => prev + pedidosRealmenteNovos.length);
          pedidosRealmenteNovos.forEach(showBrowserNotification);
        }
      }

      previousPedidosRef.current = novosPedidos;
      if (isFirstLoadRef.current) isFirstLoadRef.current = false;

      setPedidos(novosPedidos);
      console.log("1º pedido:", novosPedidos?.[0]);
    } catch (e) {
      console.error(e);
      if (!mountedRef.current) return;
      setErro("Erro ao carregar pedidos. Confirme se o backend está ligado.");
    } finally {
      loadingRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }

  // Polling automático para ENTREGADOR
  useEffect(() => {
    if (modo !== "ENTREGADOR") return;
    const tick = () => {
      loadingRef.current = false;
      carregarPedidos(filtro, false);
    };
    const interval = setInterval(tick, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, filtro]);

  useEffect(() => {
    mountedRef.current = true;
    isFirstLoadRef.current = true;
    carregarPedidos(filtroInicial, true);
    setFiltro(filtroInicial);
    return () => { mountedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

  async function mudarStatus(id, novoStatus) {
    if (!statusPermitidosNoSelect.includes(novoStatus)) {
      alert("Ação não permitida para este perfil.");
      return;
    }
    try {
      setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, status: novoStatus } : p)));
      const { data } = await api.patch(`/pedidos/${id}/status`, { status: novoStatus });
      if (!mountedRef.current) return;
      setPedidos((prev) => prev.map((p) => (p.id === id ? data : p)));
      if (filtro !== "TODOS" && novoStatus !== filtro) {
        setTimeout(() => carregarPedidos(filtro, true), 500);
      }
      alert(`✅ Status alterado para ${novoStatus}`);
    } catch (e) {
      console.error(e);
      alert("❌ Erro ao atualizar status");
      carregarPedidos(filtro, true);
    }
  }

  const clearNewOrders = () => setNewOrdersCount(0);

  function renderResumoFinanceiro(p, isEntregador = false) {
    const itens = Array.isArray(p.itens) ? p.itens : [];

    const totalViaItens = itens.reduce((acc, it) => {
      const qtd = Number(it.qtd || 0);
      const preco = Number(it.precoCentavos ?? it.precocentavos ?? 0);
      const subtotal = Number(it.subtotalCentavos ?? (qtd * preco));
      return acc + (Number.isFinite(subtotal) ? subtotal : qtd * preco);
    }, 0);

    const total = getCentavos(p, "totalCentavos", "total_centavos") || totalViaItens;
    const trocoPara = getCentavos(p, "trocoParaCentavos", "troco_para_centavos", "trocoparacentavos", "trocoPara");
    const trocoFinal = getCentavos(p, "trocoCentavos", "troco_centavos");
    const fp = String(p.formaPagamento ?? p.formapagamento ?? "").toUpperCase();
    const isDinheiro = fp === "DINHEIRO";
    const temTrocoPara = isDinheiro && trocoPara > 0;
    const trocoCalc = temTrocoPara ? Math.max(0, trocoPara - total) : 0;
    const troco = temTrocoPara ? trocoCalc : trocoFinal;

    if (total === 0 && !temTrocoPara && troco === 0) return null;

    const baseStyle = isEntregador ? {} : { opacity: 0.88, marginTop: 6 };

    return (
      <div style={baseStyle} className={isEntregador ? "ent-mini" : undefined}>
        <b>Total:</b> {centavosToBRL(total)}
        {temTrocoPara ? (
          <>
            {" "}• <b>Troco pra:</b> {centavosToBRL(trocoPara)}
            {" "}• <b>Troco:</b>{" "}
            <span style={{ fontWeight: isEntregador ? 900 : 800 }}>
              {centavosToBRL(troco)}
            </span>
          </>
        ) : troco > 0 ? (
          <>
            {" "}• <b>Troco:</b>{" "}
            <span style={{ fontWeight: isEntregador ? 900 : 800 }}>
              {centavosToBRL(troco)}
            </span>
            <span style={{ marginLeft: 8, opacity: 0.75 }}>(sem "troco pra")</span>
          </>
        ) : null}
        {!isDinheiro && fp ? (
          <span style={{ marginLeft: 8, opacity: 0.75 }}>(forma: {fp})</span>
        ) : null}
      </div>
    );
  }

  function renderItens(p, isEntregador = false) {
    const itens = Array.isArray(p.itens) ? p.itens : [];
    if (!itens.length) return null;

    const wrapStyle = isEntregador
      ? { marginTop: 8 }
      : { marginTop: 8, paddingTop: 8, borderTop: "1px dashed #ddd" };

    return (
      <div style={wrapStyle}>
        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}><b>Itens</b></div>
        <div style={{ display: "grid", gap: 4 }}>
          {itens.map((it, idx) => {
            const qtd = Number(it.qtd || 0);
            const preco = Number(it.precoCentavos ?? it.precocentavos ?? 0);
            const subtotal = Number(it.subtotalCentavos ?? (qtd * preco));
            return (
              <div
                key={it.id ?? `${p.id}-${idx}`}
                style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 13, opacity: 0.95 }}
              >
                <span>{qtd}x {it.produtoNome || `Produto #${it.produtoId ?? it.produtoid}`}</span>
                <span style={{ fontWeight: 700 }}>{centavosToBRL(subtotal)}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ======= RENDER: ENTREGADOR =======
  if (modo === "ENTREGADOR") {
    return (
      <div className="ent-wrap">
        <div className="ent-header">
          <h2 className="ent-h2">Pedidos</h2>

          {newOrdersCount > 0 && (
            <div
              style={{
                position: "absolute", top: "-10px", right: "20px",
                background: "#f44336", color: "white", padding: "8px 16px",
                borderRadius: "20px", fontWeight: "bold", fontSize: "14px",
                cursor: "pointer", animation: "pulse 2s infinite",
                boxShadow: "0 2px 8px rgba(244, 67, 54, 0.4)", transition: "transform 0.2s",
              }}
              onClick={clearNewOrders}
              title="Clique para limpar"
            >
              {newOrdersCount} novo{newOrdersCount > 1 ? "s" : ""}
            </div>
          )}

          <div className="ent-filters">
            {filtroBotoes.map((s) => (
              <button
                key={s}
                className={`ent-chip ${filtro === s ? "active" : ""}`}
                onClick={() => { setFiltro(s); carregarPedidos(s, true); }}
                disabled={loading}
                type="button"
              >
                {s}
              </button>
            ))}
          </div>

          <button className="ent-btn" onClick={() => carregarPedidos(filtro, true)} disabled={loading} type="button">
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        {!!erro && (
          <div style={{ marginTop: 12, padding: 12, border: "1px solid rgba(255,80,80,0.35)", borderRadius: 12 }}>
            {erro}
          </div>
        )}

        {loading ? <p className="ent-muted" style={{ marginTop: 12 }}>Carregando...</p> : null}

        {pedidos.length === 0 && !loading ? (
          <p className="ent-muted" style={{ marginTop: 12 }}>Nenhum pedido encontrado.</p>
        ) : (
          <div className="ent-list">
            {pedidos.map((p) => (
              <div key={p.id} className="ent-card">
                <div className="ent-row">
                  <div className="ent-left">
                    <div>
                      <span className="ent-id">#{p.id}</span>{" "}
                      <span className={`badge ${String(p.status).toLowerCase().replace("_", "")}`}>
                        {p.status}
                      </span>{" "}
                      — <b>{p.clientenome}</b>
                    </div>
                    <div className="ent-muted">{p.endereco}</div>
                    {p.telefone ? <div className="ent-muted">📞 {p.telefone}</div> : null}
                    {p.observacao ? <div className="ent-muted">📝 {p.observacao}</div> : null}
                    <div className="ent-mini">Criado em: {formatarHora(p.createdAt)}</div>
                    {renderResumoFinanceiro(p, true)}
                    {renderItens(p, true)}
                  </div>
                  <div className="ent-right">
                    <div className="ent-label">Status</div>
                    <select
                      className="ent-select"
                      value={p.status}
                      onChange={(e) => mudarStatus(p.id, e.target.value)}
                      disabled={loading}
                    >
                      {statusPermitidosNoSelect.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <div className="ent-hint">(Entregador: EM_ROTA → ENTREGUE/CANCELADO)</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
        `}</style>
      </div>
    );
  }

  // ======= RENDER: ATENDENTE =======
  if (modo === "ATENDENTE") {
    return (
      <div style={{ marginTop: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Pedidos</h3>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {filtroBotoes.map((s) => (
              <button
                key={s}
                onClick={() => { setFiltro(s); carregarPedidos(s, true); }}
                disabled={loading}
                type="button"
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: filtro === s ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.2)",
                  background: filtro === s ? "rgba(59,130,246,0.2)" : "transparent",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: filtro === s ? 700 : 400,
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <button onClick={() => carregarPedidos(filtro, true)} disabled={loading} type="button" className="btn">
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        {!!erro && (
          <div style={{ padding: 12, border: "1px solid rgba(255,80,80,0.35)", borderRadius: 12, marginBottom: 12 }}>
            {erro}
          </div>
        )}

        {loading && <p style={{ opacity: 0.6 }}>Carregando...</p>}

        {pedidos.length === 0 && !loading ? (
          <p style={{ opacity: 0.6 }}>Nenhum pedido encontrado.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {pedidos.map((p) => (
              <div
                key={p.id}
                style={{
                  padding: 16,
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>#{p.id}</span>{" "}
                    <span
                      style={{
                        padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700,
                        background:
                          p.status === "ABERTO" ? "#f59e0b" :
                          p.status === "EM_ROTA" ? "#3b82f6" :
                          p.status === "ENTREGUE" ? "#10b981" : "#ef4444",
                        color: "white",
                      }}
                    >
                      {p.status}
                    </span>{" "}
                    — <b>{p.clientenome}</b>
                  </div>
                  <div style={{ opacity: 0.75, fontSize: 13 }}>{p.endereco}</div>
                  {p.telefone ? <div style={{ opacity: 0.75, fontSize: 13 }}>📞 {p.telefone}</div> : null}
                  {p.observacao ? <div style={{ opacity: 0.75, fontSize: 13 }}>📝 {p.observacao}</div> : null}
                  <div style={{ opacity: 0.55, fontSize: 12, marginTop: 4 }}>
                    Criado em: {formatarHora(p.createdAt)}
                  </div>
                  {renderResumoFinanceiro(p, false)}
                  {renderItens(p, false)}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 160 }}>
                  <label style={{ fontSize: 12, opacity: 0.7 }}>Status</label>
                  <select
                    value={p.status}
                    onChange={(e) => mudarStatus(p.id, e.target.value)}
                    disabled={loading}
                    style={{ padding: 8, borderRadius: 8 }}
                  >
                    {statusPermitidosNoSelect.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, opacity: 0.5 }}>(Atendente: ABERTO → EM_ROTA)</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}