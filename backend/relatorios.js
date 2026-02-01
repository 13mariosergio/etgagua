const express = require("express");
const { getDB } = require("./db-postgres");

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Não autenticado." });
  if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Acesso negado." });
  next();
}

function buildWhere({ inicio, fim, status }) {
  const where = [];
  const params = [];

  // createdAt é timestamp no Postgres
  if (inicio) {
    params.push(`${inicio} 00:00:00`);
    where.push(`p."createdAt" >= $${params.length}`);
  }
  if (fim) {
    params.push(`${fim} 23:59:59`);
    where.push(`p."createdAt" <= $${params.length}`);
  }
  if (status && status !== "TODOS") {
    params.push(status);
    where.push(`p.status = $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return { whereSql, params };
}

// GET /relatorios/resumo?inicio=YYYY-MM-DD&fim=YYYY-MM-DD&status=ENTREGUE|TODOS
router.get("/resumo", requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    const { inicio, fim, status = "ENTREGUE" } = req.query;

    const { whereSql, params } = buildWhere({ inicio, fim, status });

    // totalCentavos calculado por itens
    const sqlResumo = `
      SELECT
        COUNT(DISTINCT p.id) AS pedidos,
        COALESCE(SUM(pi.qtd * pi."precoCentavos"), 0) AS totalCentavos,
        CASE
          WHEN COUNT(DISTINCT p.id) = 0 THEN 0
          ELSE CAST(ROUND(1.0 * COALESCE(SUM(pi.qtd * pi."precoCentavos"),0) / COUNT(DISTINCT p.id)) AS INTEGER)
        END AS ticketMedioCentavos,
        COALESCE(SUM(pi.qtd),0) AS itensVendidos
      FROM pedidos p
      LEFT JOIN pedido_itens pi ON pi."pedidoId" = p.id
      ${whereSql}
    `;

    const sqlPorStatus = `
      SELECT
        p.status,
        COUNT(DISTINCT p.id) AS qtd,
        COALESCE(SUM(pi.qtd * pi."precoCentavos"), 0) AS totalCentavos
      FROM pedidos p
      LEFT JOIN pedido_itens pi ON pi."pedidoId" = p.id
      ${whereSql}
      GROUP BY p.status
      ORDER BY qtd DESC
    `;

    const sqlPorPagamento = `
      SELECT
        COALESCE(p."formaPagamento", 'NAO_INFORMADO') AS formaPagamento,
        COUNT(DISTINCT p.id) AS qtd,
        COALESCE(SUM(pi.qtd * pi."precoCentavos"), 0) AS totalCentavos
      FROM pedidos p
      LEFT JOIN pedido_itens pi ON pi."pedidoId" = p.id
      ${whereSql}
      GROUP BY COALESCE(p."formaPagamento", 'NAO_INFORMADO')
      ORDER BY totalCentavos DESC, qtd DESC
    `;

    const [resumo, porStatus, porPagamento] = await Promise.all([
      db.query(sqlResumo, params),
      db.query(sqlPorStatus, params),
      db.query(sqlPorPagamento, params),
    ]);

    res.json({
      resumo: resumo.rows[0] || { pedidos: 0, totalCentavos: 0, ticketMedioCentavos: 0, itensVendidos: 0 },
      porStatus: porStatus.rows || [],
      porPagamento: porPagamento.rows || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /relatorios/produtos?inicio=YYYY-MM-DD&fim=YYYY-MM-DD&status=ENTREGUE|TODOS
router.get("/produtos", requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    const { inicio, fim, status = "ENTREGUE" } = req.query;

    const { whereSql, params } = buildWhere({ inicio, fim, status });

    const sql = `
      SELECT
        pr.id AS "produtoId",
        pr.nome AS "produtoNome",
        COALESCE(SUM(pi.qtd),0) AS "qtdVendida",
        COALESCE(SUM(pi.qtd * pi."precoCentavos"),0) AS "totalCentavos"
      FROM pedido_itens pi
      JOIN pedidos p ON p.id = pi."pedidoId"
      JOIN produtos pr ON pr.id = pi."produtoId"
      ${whereSql}
      GROUP BY pr.id, pr.nome
      ORDER BY "totalCentavos" DESC, "qtdVendida" DESC
      LIMIT 50
    `;

    const out = await db.query(sql, params);
    res.json(out.rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /relatorios/pedidos?inicio=YYYY-MM-DD&fim=YYYY-MM-DD&status=ENTREGUE|TODOS
router.get("/pedidos", requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    const { inicio, fim, status = "TODOS" } = req.query;

    const { whereSql, params } = buildWhere({ inicio, fim, status });

    const sql = `
      SELECT
        p.id,
        p."clienteNome",
        p.endereco,
        p.status,
        p."createdAt",
        COALESCE(p."formaPagamento", 'NAO_INFORMADO') AS "formaPagamento",
        COALESCE(SUM(pi.qtd * pi."precoCentavos"),0) AS "totalCentavos"
      FROM pedidos p
      LEFT JOIN pedido_itens pi ON pi."pedidoId" = p.id
      ${whereSql}
      GROUP BY p.id
      ORDER BY p.id DESC
      LIMIT 200
    `;

    const out = await db.query(sql, params);
    res.json(out.rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
