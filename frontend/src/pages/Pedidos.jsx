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

  const mountedRef = useRef(true);
  const loadingRef = useRef(false);

  async function carregarPedidos(f = filtro) {
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
      setPedidos(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      if (!mountedRef.current) return;
      setErro("Erro ao carregar pedidos.");
    } finally {
      if (mountedRef.current) setLoading(false);
      loadingRef.current = false;
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    carregarPedidos(filtroInicial);
    setFiltro(filtroInicial);
    return () => (mountedRef.current = false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

  async function mudarStatus(id, novoStatus) {
    if (!statusPermitidosNoSelect.includes(novoStatus)) {
      alert("Ação não permitida.");
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

      setPedidos((prev) =>
        prev.map((p) => (p.id === id ? data : p))
      );
    } catch (e) {
      console.error(e);
      alert("Erro ao atualizar status");
      carregarPedidos(filtro);
    }
  }

  function renderResumoFinanceiro(p, isEntregador = false) {
    const total =
      Number(
        p.totalCentavos ??
          p.total_centavos ??
          p.totalCentavo ??
          p.total_centavo ??
          0
      );

    const trocoParaRaw =
      p.troco_para_centavos ??
      p.trocoparacentavos ??
      p.trocoParaCentavos;

    const trocoPara =
      trocoParaRaw === null || trocoParaRaw === undefined
        ? null
        : Number(trocoParaRaw);

    const isDinheiro =
      String(p.formaPagamento || "").toUpperCase() === "DINHEIRO";

    const temTrocoPara =
      isDinheiro && trocoPara !== null && trocoPara > 0;

    if (!hasMoney(total) && !temTrocoPara) return null;

    return (
      <div className={isEntregador ? "ent-mini" : undefined}>
        <b>Total:</b> {centavosToBRL(total)}
        {temTrocoPara && (
          <>
            {" "}• <b>Troco pra:</b> {centavosToBRL(trocoPara)}
          </>
        )}
      </div>
    );
  }

  if (modo === "ENTREGADOR") {
    return (
      <div className="ent-list">
        {pedidos.map((p) => (
          <div key={p.id} className="ent-card">
            <b>{p.clienteNome}</b>
            <div>{p.endereco}</div>
            {renderResumoFinanceiro(p, true)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {pedidos.map((p) => (
        <div key={p.id}>
          <b>{p.clienteNome}</b>
          {renderResumoFinanceiro(p, false)}
        </div>
      ))}
    </div>
  );
}
