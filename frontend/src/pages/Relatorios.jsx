import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import "./Relatorios.css";

const STATUS = ["TODOS", "ENTREGUE", "ABERTO", "EM_ROTA", "CANCELADO"];

function centavosToBRL(c) {
  const v = Number(c || 0) / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function Relatorios() {
  // por padrão: hoje
  const [inicio, setInicio] = useState(todayISO());
  const [fim, setFim] = useState(todayISO());
  const [status, setStatus] = useState("TODOS");

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const [resumo, setResumo] = useState(null);
  const [porStatus, setPorStatus] = useState([]);
  const [itens, setItens] = useState({ itensVendidos: 0 });
  const [produtos, setProdutos] = useState([]);
  const [pedidos, setPedidos] = useState([]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (inicio) params.set("inicio", inicio);
    if (fim) params.set("fim", fim);
    if (status) params.set("status", status);
    return params.toString();
  }, [inicio, fim, status]);

  async function carregarTudo() {
    setLoading(true);
    setErro("");
    try {
      const [rResumo, rProdutos, rPedidos] = await Promise.all([
        api.get(`/relatorios/resumo?${query}`),
        api.get(`/relatorios/produtos?${query}`),
        api.get(`/relatorios/pedidos?${query}`),
      ]);

      setResumo(rResumo.data?.resumo || null);
      setPorStatus(rResumo.data?.porStatus || []);
      setItens(rResumo.data?.itens || { itensVendidos: 0 });

      setProdutos(Array.isArray(rProdutos.data) ? rProdutos.data : []);
      setPedidos(Array.isArray(rPedidos.data) ? rPedidos.data : []);
    } catch (e) {
      console.error(e);
      setErro(
        e?.response?.data?.error ||
          "Erro ao carregar relatórios. Confirme se você está logado como ADMIN e o backend está ligado."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ticket = resumo?.ticketMedioCentavos ?? 0;

  return (
    <div className="rep-wrap">
      <div className="rep-top">
        <div>
          <h2 className="rep-title">Relatórios</h2>
          <div className="rep-sub">
            Vendas, pedidos, produtos e troco — filtre por período e status.
          </div>
        </div>

        <button className="rep-btn" onClick={carregarTudo} disabled={loading} type="button">
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      <div className="rep-filters">
        <div className="rep-field">
          <label>Início</label>
          <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>

        <div className="rep-field">
          <label>Fim</label>
          <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>

        <div className="rep-field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <button className="rep-btn rep-primary" onClick={carregarTudo} disabled={loading} type="button">
          Aplicar filtro
        </button>
      </div>

      {erro ? <div className="rep-error">{erro}</div> : null}

      {/* KPIs */}
      <div className="rep-kpis">
        <div className="rep-kpi">
          <div className="kpi-label">Total vendido</div>
          <div className="kpi-value">{centavosToBRL(resumo?.totalCentavos ?? 0)}</div>
          <div className="kpi-mini">No período / status filtrado</div>
        </div>

        <div className="rep-kpi">
          <div className="kpi-label">Pedidos</div>
          <div className="kpi-value">{resumo?.pedidos ?? 0}</div>
          <div className="kpi-mini">Quantidade</div>
        </div>

        <div className="rep-kpi">
          <div className="kpi-label">Ticket médio</div>
          <div className="kpi-value">{centavosToBRL(ticket)}</div>
          <div className="kpi-mini">Total ÷ pedidos</div>
        </div>

        <div className="rep-kpi">
          <div className="kpi-label">Itens vendidos</div>
          <div className="kpi-value">{itens?.itensVendidos ?? 0}</div>
          <div className="kpi-mini">Somatório de quantidades</div>
        </div>

        <div className="rep-kpi">
          <div className="kpi-label">Troco total</div>
          <div className="kpi-value">{centavosToBRL(resumo?.trocoTotalCentavos ?? 0)}</div>
          <div className="kpi-mini">Troco necessário no período</div>
        </div>
      </div>

      {/* Status breakdown */}
      <div className="rep-grid">
        <div className="rep-card">
          <div className="rep-card-title">Pedidos por status</div>
          {porStatus?.length ? (
            <div className="rep-table">
              <div className="rep-tr rep-head">
                <div>Status</div>
                <div>Qtd</div>
                <div>Total</div>
              </div>
              {porStatus.map((s) => (
                <div className="rep-tr" key={s.status}>
                  <div>{s.status}</div>
                  <div>{s.qtd}</div>
                  <div>{centavosToBRL(s.totalCentavos)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rep-muted">Sem dados.</div>
          )}
        </div>

        {/* Top produtos */}
        <div className="rep-card">
          <div className="rep-card-title">Top produtos</div>
          {produtos?.length ? (
            <div className="rep-table">
              <div className="rep-tr rep-head">
                <div>Produto</div>
                <div>Qtd</div>
                <div>Faturamento</div>
              </div>
              {produtos.slice(0, 12).map((p) => (
                <div className="rep-tr" key={p.produtoId}>
                  <div>{p.produtoNome}</div>
                  <div>{p.qtdVendida}</div>
                  <div>{centavosToBRL(p.totalCentavos)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rep-muted">Sem dados.</div>
          )}
        </div>
      </div>

      {/* Pedidos list */}
      <div className="rep-card" style={{ marginTop: 12 }}>
        <div className="rep-card-title">Pedidos do período (últimos 200)</div>

        {pedidos?.length ? (
          <div className="rep-table">
            <div className="rep-tr rep-head rep-ped">
              <div>ID</div>
              <div>Cliente</div>
              <div>Status</div>
              <div>Total</div>
              <div>Troco</div>
              <div>Data</div>
            </div>

            {pedidos.map((p) => (
              <div className="rep-tr rep-ped" key={p.id}>
                <div>#{p.id}</div>
                <div title={p.endereco}>{p.clienteNome}</div>
                <div className="rep-badge">{p.status}</div>
                <div>{centavosToBRL(p.totalCentavos)}</div>
                <div>{centavosToBRL(p.trocoCentavos)}</div>
                <div className="rep-mini">{p.criadoEm}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rep-muted">Sem pedidos para o filtro atual.</div>
        )}
      </div>
    </div>
  );
}
