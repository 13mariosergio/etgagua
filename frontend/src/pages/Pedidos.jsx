import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";

const ALL_STATUS = ["ABERTO", "EM_ROTA", "ENTREGUE", "CANCELADO"];

function centavosToBRL(c) {
  const v = Number(c || 0) / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function hasMoney(v) {
  return v !== null && v !== undefined && Number(v) > 0;
}
function getCentavos(p, ...keys) {
  for (const k of keys) {
    const v = p?.[k];
    if (v !== null && v !== undefined && v !== "") return Number(v);
  }
  return 0;
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
    if (modo === "ENTREGADOR")
      return ["ABERTO", "EM_ROTA", "ENTREGUE", "CANCELADO"];
    if (modo === "ATENDENTE") return ["ABERTO", "EM_ROTA"];
    return ALL_STATUS;
  }, [modo]);

  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState(filtroInicial);
  
  // 🔊 NOVO: Estado para notificações
  const [newOrdersCount, setNewOrdersCount] = useState(0);

  const mountedRef = useRef(true);
  const loadingRef = useRef(false);
  
  // 🔊 NOVO: Refs para tracking de pedidos e áudio
  const previousPedidosRef = useRef([]);
  const audioRef = useRef(null);
  const isFirstLoadRef = useRef(true);

  // 🔊 NOVO: Solicitar permissão de notificação
  useEffect(() => {
    if (modo === "ENTREGADOR" && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [modo]);

  // 🔊 NOVO: Função para tocar som
 const playSound = () => {
  try {
    // Criar beep com Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 400; // Frequência do beep
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.9, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.05, audioContext.currentTime + 0.9);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.9);
  } catch (error) {
    console.log('Erro ao tocar som:', error);
  }
};

  // 🔊 NOVO: Função para vibrar
  const vibrate = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  };

  // 🔊 NOVO: Função para mostrar notificação do navegador
  const showBrowserNotification = (pedido) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🚚 Novo Pedido!', {
        body: `Cliente: ${pedido.clienteNome}\nEndereço: ${pedido.endereco}`,
        icon: '/logo.png',
        tag: `pedido-${pedido.id}`,
        requireInteraction: false
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
        f && f !== "TODOS"
          ? `/pedidos?status=${encodeURIComponent(f)}`
          : "/pedidos";

      const { data } = await api.get(url);

      if (!mountedRef.current) return;
      
      const novosPedidos = Array.isArray(data) ? data : [];
      
      // 🔊 NOVO: Detectar pedidos novos (apenas para ENTREGADOR e após primeira carga)
      if (modo === "ENTREGADOR" && !isFirstLoadRef.current && !silent) {
        const pedidosAntigos = previousPedidosRef.current;
        
        if (pedidosAntigos.length > 0) {
          const idsAntigos = new Set(pedidosAntigos.map(p => p.id));
          const pedidosRealmenteNovos = novosPedidos.filter(p => !idsAntigos.has(p.id));

          if (pedidosRealmenteNovos.length > 0) {
            console.log('🔔 Novos pedidos detectados:', pedidosRealmenteNovos.length);
            
            // Tocar som
            playSound();
            
            // Vibrar
            vibrate();
            
            // Incrementar contador
            setNewOrdersCount(prev => prev + pedidosRealmenteNovos.length);
            
            // Mostrar notificação do navegador
            pedidosRealmenteNovos.forEach(pedido => {
              showBrowserNotification(pedido);
            });
          }
        }
      }
      
      // Atualizar refs
      previousPedidosRef.current = novosPedidos;
      if (isFirstLoadRef.current) {
        isFirstLoadRef.current = false;
      }
      
      setPedidos(novosPedidos);
    } catch (e) {
      console.error(e);
      if (!mountedRef.current) return;
      setErro("Erro ao carregar pedidos. Confirme se o backend está ligado.");
    } finally {
      if (mountedRef.current) setLoading(false);
      loadingRef.current = false;
    }
  }

  // 🔊 NOVO: Polling automático para ENTREGADOR
  useEffect(() => {
    if (modo !== "ENTREGADOR") return;

    const interval = setInterval(() => {
      carregarPedidos(filtro, false);
    }, 10000); // 10 segundos

    return () => clearInterval(interval);
  }, [modo, filtro]);

  useEffect(() => {
    mountedRef.current = true;
    isFirstLoadRef.current = true;
    carregarPedidos(filtroInicial, true); // Primeira carga silenciosa
    setFiltro(filtroInicial);

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

  async function mudarStatus(id, novoStatus) {
    if (!statusPermitidosNoSelect.includes(novoStatus)) {
      alert("Ação não permitida para este perfil.");
      return;
    }

    try {
      setPedidos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: novoStatus } : p))
      );

      const { data } = await api.patch(`/pedidos/${id}/status`, {
        status: novoStatus,
      });

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

  // 🔊 NOVO: Limpar contador
  const clearNewOrders = () => {
    setNewOrdersCount(0);
  };

function renderResumoFinanceiro(p, isEntregador = false) {
  const total = Number(p.totalCentavos ?? p.total_centavos ?? 0);

  const trocoParaRaw =
    p.troco_para_centavos ?? p.trocoparacentavos ?? p.trocoParaCentavos;

  const trocoPara =
    trocoParaRaw === null || trocoParaRaw === undefined
      ? 0
      : Number(trocoParaRaw);

  const isDinheiro =
    String(p.formaPagamento || "").toUpperCase() === "DINHEIRO";

  const temTrocoPara = isDinheiro && trocoPara > 0;

  const troco = temTrocoPara ? Math.max(0, trocoPara - total) : 0;

  if (total === 0 && !temTrocoPara) return null;

  const baseStyle = isEntregador ? {} : { opacity: 0.88, marginTop: 6 };

  return (
    <div style={baseStyle} className={isEntregador ? "ent-mini" : undefined}>
      <b>Total:</b> {centavosToBRL(total)}
      {temTrocoPara ? (
        <>
          {" "}
          • <b>Troco pra:</b> {centavosToBRL(trocoPara)}
          {" "}
          • <b>Troco:</b>{" "}
          <span style={isEntregador ? { fontWeight: 900 } : { fontWeight: 800 }}>
            {centavosToBRL(troco)}
          </span>
        </>
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
        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
          <b>Itens</b>
        </div>

        <div style={{ display: "grid", gap: 4 }}>
          {itens.map((it) => (
            <div
              key={it.id || `${it.pedidoId}-${it.produtoId}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
                fontSize: 13,
                opacity: 0.95,
              }}
            >
              <span>
                {it.qtd}x {it.produtoNome || `Produto #${it.produtoId}`}
              </span>
              <span style={{ fontWeight: 700 }}>
                {centavosToBRL(it.subtotalCentavos)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ======= RENDER: ENTREGADOR (com CSS + 🔊 BADGE) =======
  if (modo === "ENTREGADOR") {
    return (
      <div>
        <div className="ent-header">
          <h2 className="ent-h2">Pedidos</h2>

          {/* 🔊 NOVO: Badge de pedidos novos */}
          {newOrdersCount > 0 && (
            <div 
              style={{
                position: 'absolute',
                top: '-10px',
                right: '20px',
                background: '#f44336',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '20px',
                fontWeight: 'bold',
                fontSize: '14px',
                cursor: 'pointer',
                animation: 'pulse 2s infinite',
                boxShadow: '0 2px 8px rgba(244, 67, 54, 0.4)',
                transition: 'transform 0.2s',
              }}
              onClick={clearNewOrders}
              title="Clique para limpar"
            >
              {newOrdersCount} novo{newOrdersCount > 1 ? 's' : ''}
            </div>
          )}

          <div className="ent-filters">
            {filtroBotoes.map((s) => (
              <button
                key={s}
                className={`ent-chip ${filtro === s ? "active" : ""}`}
                onClick={() => {
                  setFiltro(s);
                  carregarPedidos(s, true);
                }}
                disabled={loading}
                type="button"
              >
                {s}
              </button>
            ))}
          </div>

          <button
            className="ent-btn"
            onClick={() => carregarPedidos(filtro, true)}
            disabled={loading}
            type="button"
          >
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        {erro ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              border: "1px solid rgba(255,80,80,0.35)",
              borderRadius: 12,
            }}
          >
            {erro}
          </div>
        ) : null}

        {loading ? (
          <p className="ent-muted" style={{ marginTop: 12 }}>
            Carregando...
          </p>
        ) : null}

        {pedidos.length === 0 && !loading ? (
          <p className="ent-muted" style={{ marginTop: 12 }}>
            Nenhum pedido encontrado.
          </p>
        ) : (
          <div className="ent-list">
            {pedidos.map((p) => (
              <div key={p.id} className="ent-card">
                <div className="ent-row">
                  <div className="ent-left">
                    <div>
                      <span className="ent-id">#{p.id}</span>{" "}
                      <span
                        className={`badge ${String(p.status)
                          .toLowerCase()
                          .replace("_", "")}`}
                      >
                        {p.status}
                      </span>{" "}
                      — <b>{p.clienteNome}</b>
                    </div>

                    <div className="ent-muted">{p.endereco}</div>
                    {p.telefone ? (
                      <div className="ent-muted">📞 {p.telefone}</div>
                    ) : null}
                    {p.observacao ? (
                      <div className="ent-muted">📝 {p.observacao}</div>
                    ) : null}

                    <div className="ent-mini">Criado em: {p.criadoEm}</div>

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
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>

                    <div className="ent-hint">
                      (Entregador: EM_ROTA → ENTREGUE/CANCELADO)
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 🔊 NOVO: CSS para animação do badge */}
        <style>{`
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.05);
            }
          }
        `}</style>
      </div>
    );
  }

  // ======= RENDER: ATENDENTE/GERAL (layout original) =======
  return (
    <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0 }}>Pedidos</h2>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {filtroBotoes.map((s) => (
            <button
              key={s}
              onClick={() => {
                setFiltro(s);
                carregarPedidos(s);
              }}
              disabled={loading}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #333",
                background: filtro === s ? "#111" : "#fff",
                color: filtro === s ? "#fff" : "#111",
                fontWeight: 700,
                cursor: "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {s}
            </button>
          ))}

          <button onClick={() => carregarPedidos(filtro)} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </div>

      {erro ? (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #f2c2c2", borderRadius: 10 }}>
          {erro}
        </div>
      ) : null}

      {loading ? <p style={{ marginTop: 12, opacity: 0.7 }}>Carregando...</p> : null}

      {pedidos.length === 0 && !loading ? (
        <p style={{ marginTop: 12 }}>Nenhum pedido encontrado.</p>
      ) : (
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          {pedidos.map((p) => (
            <div
              key={p.id}
              style={{
                padding: 12,
                border: "1px solid #eee",
                borderRadius: 12,
                background: "0,0,0,0.21",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ minWidth: 260 }}>
                  <strong>#{p.id}</strong> — <strong>{p.clienteNome}</strong>
                  <div style={{ opacity: 0.8, marginTop: 4 }}>{p.endereco}</div>
                  {p.telefone ? <div style={{ opacity: 0.8 }}>📞 {p.telefone}</div> : null}
                  {p.observacao ? <div style={{ opacity: 0.8 }}>📝 {p.observacao}</div> : null}
                  <div style={{ opacity: 0.6, marginTop: 6 }}>Criado em: {p.criadoEm}</div>

                  {renderResumoFinanceiro(p, false)}
                  {renderItens(p, false)}
                </div>

                <div style={{ minWidth: 180 }}>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Status</div>
                  <select
                    value={p.status}
                    onChange={(e) => mudarStatus(p.id, e.target.value)}
                    style={{ width: "100%", padding: 8 }}
                    disabled={loading}
                  >
                    {statusPermitidosNoSelect.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  {modo === "ATENDENTE" ? (
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                      (Atendente: ABERTO → EM_ROTA)
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
