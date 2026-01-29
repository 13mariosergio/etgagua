const express = require("express");
const db = require("./db");

const router = express.Router();

// precisa estar logado e ser ADMIN
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Não autenticado." });
  if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Acesso negado." });
  next();
}

function rangeFromDates(inicio, fim) {
  const ini = inicio ? `${inicio} 00:00:00` : null;
  const end = fim ? `${fim} 23:59:59` : null;
  return { ini, end };
}

// GET /relatorios/resumo?inicio=YYYY-MM-DD&fim=YYYY-MM-DD&status=ENTREGUE|TODOS
router.get("/resumo", requireAdmin, (req, res) => {
  const { inicio, fim, status = "ENTREGUE" } = req.query;
  const { ini, end } = rangeFromDates(inicio, fim);

  const where = [];
  const params = [];

  if (ini && end) {
    where.push("p.criadoEm BETWEEN ? AND ?");
    params.push(ini, end);
  } else if (ini) {
    where.push("p.criadoEm >= ?");
    params.push(ini);
  } else if (end) {
    where.push("p.criadoEm <= ?");
    params.push(end);
  }

  if (status && status !== "TODOS") {
    where.push("p.status = ?");
    params.push(status);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sqlResumo = `
    SELECT
      COUNT(*) as pedidos,
      COALESCE(SUM(p.totalCentavos),0) as totalCentavos,
      CASE WHEN COUNT(*) = 0 THEN 0 ELSE CAST(ROUND(1.0 * COALESCE(SUM(p.totalCentavos),0) / COUNT(*)) AS INTEGER) END as ticketMedioCentavos,
      COALESCE(SUM(p.trocoCentavos),0) as trocoTotalCentavos
    FROM pedidos p
    ${whereSql}
  `;

  const sqlPorStatus = `
    SELECT p.status, COUNT(*) as qtd, COALESCE(SUM(p.totalCentavos),0) as totalCentavos
    FROM pedidos p
    ${whereSql}
    GROUP BY p.status
    ORDER BY qtd DESC
  `;

  const sqlItens = `
    SELECT COALESCE(SUM(pi.qtd),0) as itensVendidos
    FROM pedido_itens pi
    JOIN pedidos p ON p.id = pi.pedidoId
    ${whereSql}
  `;

  // ✅ NOVO: Por forma de pagamento (Dinheiro / Pix / Cartão)
  // Observação: se formaPagamento estiver null em pedidos antigos, cai em 'NAO_INFORMADO'
  const sqlPorPagamento = `
    SELECT
      COALESCE(p.formaPagamento, 'NAO_INFORMADO') as formaPagamento,
      COUNT(*) as qtd,
      COALESCE(SUM(p.totalCentavos),0) as totalCentavos,
      COALESCE(SUM(p.trocoCentavos),0) as trocoCentavos
    FROM pedidos p
    ${whereSql}
    GROUP BY COALESCE(p.formaPagamento, 'NAO_INFORMADO')
    ORDER BY totalCentavos DESC, qtd DESC
  `;

  db.get(sqlResumo, params, (err, resumo) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all(sqlPorStatus, params, (err2, porStatus) => {
      if (err2) return res.status(500).json({ error: err2.message });

      db.get(sqlItens, params, (err3, itensRow) => {
        if (err3) itensRow = { itensVendidos: 0 };

        db.all(sqlPorPagamento, params, (err4, porPagamento) => {
          if (err4) return res.status(500).json({ error: err4.message });

          // ✅ extras úteis para fechamento de caixa
          const dinheiro = (porPagamento || []).find((x) => x.formaPagamento === "DINHEIRO");
          const dinheiroTotal = dinheiro ? Number(dinheiro.totalCentavos || 0) : 0;
          const dinheiroTroco = dinheiro ? Number(dinheiro.trocoCentavos || 0) : 0;

          res.json({
            resumo,
            porStatus,
            porPagamento, // ✅ novo retorno principal
            caixa: {
              dinheiroBrutoCentavos: dinheiroTotal,
              dinheiroTrocoCentavos: dinheiroTroco,
              dinheiroLiquidoCentavos: Math.max(0, dinheiroTotal), // (troco é entregue ao cliente; controle separado)
            },
            itens: itensRow || { itensVendidos: 0 },
          });
        });
      });
    });
  });
});

// GET /relatorios/produtos?inicio=YYYY-MM-DD&fim=YYYY-MM-DD&status=ENTREGUE|TODOS
router.get("/produtos", requireAdmin, (req, res) => {
  const { inicio, fim, status = "ENTREGUE" } = req.query;
  const { ini, end } = rangeFromDates(inicio, fim);

  const where = [];
  const params = [];

  if (ini && end) {
    where.push("p.criadoEm BETWEEN ? AND ?");
    params.push(ini, end);
  } else if (ini) {
    where.push("p.criadoEm >= ?");
    params.push(ini);
  } else if (end) {
    where.push("p.criadoEm <= ?");
    params.push(end);
  }

  if (status && status !== "TODOS") {
    where.push("p.status = ?");
    params.push(status);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `
    SELECT
      pr.id as produtoId,
      pr.nome as produtoNome,
      COALESCE(SUM(pi.qtd),0) as qtdVendida,
      COALESCE(SUM(pi.subtotalCentavos),0) as totalCentavos
    FROM pedido_itens pi
    JOIN pedidos p ON p.id = pi.pedidoId
    JOIN produtos pr ON pr.id = pi.produtoId
    ${whereSql}
    GROUP BY pr.id, pr.nome
    ORDER BY totalCentavos DESC, qtdVendida DESC
    LIMIT 50
  `;

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// GET /relatorios/pedidos?inicio=YYYY-MM-DD&fim=YYYY-MM-DD&status=ENTREGUE|TODOS
router.get("/pedidos", requireAdmin, (req, res) => {
  const { inicio, fim, status = "TODOS" } = req.query;
  const { ini, end } = rangeFromDates(inicio, fim);

  const where = [];
  const params = [];

  if (ini && end) {
    where.push("p.criadoEm BETWEEN ? AND ?");
    params.push(ini, end);
  } else if (ini) {
    where.push("p.criadoEm >= ?");
    params.push(ini);
  } else if (end) {
    where.push("p.criadoEm <= ?");
    params.push(end);
  }

  if (status && status !== "TODOS") {
    where.push("p.status = ?");
    params.push(status);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `
    SELECT
      p.id,
      p.clienteNome,
      p.endereco,
      p.status,
      p.criadoEm,
      p.totalCentavos,
      p.trocoParaCentavos,
      p.trocoCentavos,
      COALESCE(p.formaPagamento, 'NAO_INFORMADO') as formaPagamento
    FROM pedidos p
    ${whereSql}
    ORDER BY p.id DESC
    LIMIT 200
  `;

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

module.exports = router;
