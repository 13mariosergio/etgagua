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

export default function Pedidos({ modo = "GERAL" }) {
  const filtroInicial = modo === "ENTREGADOR" ? "TODOS" : modo === "ATENDENTE" ? "ABERTO" : "TODOS";

  const filtroBotoes = useMemo(() => {
    if (modo === "ENTREGADOR") return ["TODOS", "ABERTO", "EM_ROTA", "ENTREGUE", "CANCELADO"];
    if (modo === "ATENDENTE") return ["ABERTO", "EM_ROTA", "ENTREGUE", "CANCELADO", "TODOS"];
    return ["TODOS", ...ALL_STATUS];
  }, [modo]);

  const statusPermitidosNoSelect = useMemo(() => {
    if (modo === "ENTREGADOR") return ["ABERTO", "EM_ROTA", "ENTREGUE", "CANCELADO"];
    if (modo === "ATENDENTE") return ["ABERTO", "EM_ROTA"]; // atendente só abre e repassa
    return ALL_STATUS;
  }, [modo]);

  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState(filtroInicial);

  const mountedRef = useRef(true);
  const loadingRef = useRef(false);

  async function carregarPedidos(f = filtro) {
    if (loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    setErro("");

    try {
      const url = f && f !== "TODOS" ? `/pedidos?status=${encodeURIComponent(f)}` : "/pedidos";
      const { data } = await api.get(url);
      if (!mountedRef.current) return;
      setPedidos(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      if (!mountedRef.current) return;
      setErro("Erro ao carregar pedidos. Confirme se o backend está ligado (http://localhost:3333).");
    } finally {
      if (mountedRef.current) setLoading(false);
      loadingRef.current = false;
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    carregarPedidos(filtroInicial);
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
      // otimista
      setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, status: novoStatus } : p)));

      const { data } = await api.patch(`/pedidos/${id}/status`, { status: novoStatus });
      if (!mountedRef.current) return;

      setPedidos((prev) => prev.map((p) => (p.id === id ? data : p)));

      // se o filtro atual for específico e o status mudou pra fora dele, recarrega pra “sumir”
      if (filtro !== "TODOS" && novoStatus !== filtro) {
        carregarPedidos(filtro);
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao atualizar status. Vou recarregar a lista.");
      carregarPedidos(filtro);
    }
  }

  function renderResumoFinanceiro(p, isEntregador = false) {
    const total = Number(p.totalCentavos || 0);
    const trocoPara = p.trocoParaCentavos === null || p.trocoParaCentavos === undefined ? null : Number(p.trocoParaCentavos);
    const troco = Number(p.trocoCentavos || 0);

    const temTrocoPara = trocoPara !== null && Number.isFinite(trocoPara) && trocoPara > 0;

    if (!hasMoney(total) && !temTrocoPara) return null;

    const baseStyle = isEntregador
      ? { }
      : { opacity: 0.88, marginTop: 6 };

    return (
      <div style={baseStyle} className={isEntregador ? "ent-mini" : undefined}>
        <b>Total:</b> {centavosToBRL(total)}
        {temTrocoPara ? (
          <>
            {" "}• <b>Troco pra:</b> {centavosToBRL(trocoPara)} • <b>Troco:</b>{" "}
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

  // ======= RENDER: ENTREGADOR (com CSS) =======
  if (modo === "ENTREGADOR") {
    return (
      <div>
        <div className="ent-header">
          <h2 className="ent-h2">Pedidos</h2>

          <div className="ent-filters">
            {filtroBotoes.map((s) => (
              <button
                key={s}
                className={`ent-chip ${filtro === s ? "active" : ""}`}
                onClick={() => {
                  setFiltro(s);
                  carregarPedidos(s);
                }}
                disabled={loading}
                type="button"
              >
                {s}
              </button>
            ))}
          </div>

          <button className="ent-btn" onClick={() => carregarPedidos(filtro)} disabled={loading} type="button">
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        {erro ? (
          <div style={{ marginTop: 12, padding: 12, border: "1px solid rgba(255,80,80,0.35)", borderRadius: 12 }}>
            {erro}
          </div>
        ) : null}

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
                      — <b>{p.clienteNome}</b>
                    </div>

                    <div className="ent-muted">{p.endereco}</div>
                    {p.telefone ? <div className="ent-muted">📞 {p.telefone}</div> : null}
                    {p.observacao ? <div className="ent-muted">📝 {p.observacao}</div> : null}

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

                    <div className="ent-hint">(Entregador: EM_ROTA → ENTREGUE/CANCELADO)</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ======= RENDER: ATENDENTE/GERAL (layout original + total/troco + itens) =======
  return (
    <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
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
