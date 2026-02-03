const express = require("express");
const { getDB } = require("./db-postgres");

const router = express.Router();

// Requer ADMIN
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
router.get("/resumo", requireAdmin, async (req, res) => {
  const { inicio, fim, status = "ENTREGUE" } = req.query;
  const { ini, end } = rangeFromDates(inicio, fim);

  const where = [];
  const params = [];
  let paramIndex = 1;

  if (ini && end) {
    where.push(`p.createdat BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
    params.push(ini, end);
    paramIndex += 2;
  } else if (ini) {
    where.push(`p.createdat >= $${paramIndex}`);
    params.push(ini);
    paramIndex++;
  } else if (end) {
    where.push(`p.createdat <= $${paramIndex}`);
    params.push(end);
    paramIndex++;
  }

  if (status && status !== "TODOS") {
    where.push(`p.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const db = getDB();

    // Resumo geral
    const resumoSql = `
      SELECT
        COUNT(*) as pedidos,
        COALESCE(SUM((
          SELECT COALESCE(SUM(pi.precocentavos * pi.qtd), 0)
          FROM pedido_itens pi
          WHERE pi.pedidoid = p.id
        )), 0) as "totalCentavos"
      FROM pedidos p
      ${whereSql}
    `;
    const resumo = await db.query(resumoSql, params);

    // Por status
    const porStatusSql = `
      SELECT 
        p.status, 
        COUNT(*) as qtd,
        COALESCE(SUM((
          SELECT COALESCE(SUM(pi.precocentavos * pi.qtd), 0)
          FROM pedido_itens pi
          WHERE pi.pedidoid = p.id
        )), 0) as "totalCentavos"
      FROM pedidos p
      ${whereSql}
      GROUP BY p.status
      ORDER BY qtd DESC
    `;
    const porStatus = await db.query(porStatusSql, params);

    // Itens vendidos
    const itensSql = `
      SELECT COALESCE(SUM(pi.qtd), 0) as "itensVendidos"
      FROM pedido_itens pi
      JOIN pedidos p ON p.id = pi.pedidoid
      ${whereSql}
    `;
    const itensRow = await db.query(itensSql, params);

    // Por forma de pagamento
    const porPagamentoSql = `
      SELECT
        COALESCE(p.formapagamento, 'NAO_INFORMADO') as "formaPagamento",
        COUNT(*) as qtd,
        COALESCE(SUM((
          SELECT COALESCE(SUM(pi.precocentavos * pi.qtd), 0)
          FROM pedido_itens pi
          WHERE pi.pedidoid = p.id
        )), 0) as "totalCentavos",
        COALESCE(SUM(
          CASE WHEN p.troco_para_centavos IS NOT NULL 
          THEN p.troco_para_centavos - (
            SELECT COALESCE(SUM(pi.precocentavos * pi.qtd), 0)
            FROM pedido_itens pi
            WHERE pi.pedidoid = p.id
          )
          ELSE 0 END
        ), 0) as "trocoCentavos"
      FROM pedidos p
      ${whereSql}
      GROUP BY COALESCE(p.formapagamento, 'NAO_INFORMADO')
      ORDER BY "totalCentavos" DESC, qtd DESC
    `;
    const porPagamento = await db.query(porPagamentoSql, params);

    const dinheiro = porPagamento.rows.find((x) => x.formaPagamento === "DINHEIRO");
    const dinheiroTotal = dinheiro ? Number(dinheiro.totalCentavos || 0) : 0;
    const dinheiroTroco = dinheiro ? Number(dinheiro.trocoCentavos || 0) : 0;

    res.json({
      resumo: resumo.rows[0] || { pedidos: 0, totalCentavos: 0 },
      porStatus: porStatus.rows || [],
      porPagamento: porPagamento.rows || [],
      caixa: {
        dinheiroBrutoCentavos: dinheiroTotal,
        dinheiroTrocoCentavos: dinheiroTroco,
        dinheiroLiquidoCentavos: Math.max(0, dinheiroTotal),
      },
      itens: itensRow.rows[0] || { itensVendidos: 0 },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /relatorios/produtos?inicio=YYYY-MM-DD&fim=YYYY-MM-DD&status=ENTREGUE|TODOS
router.get("/produtos", requireAdmin, async (req, res) => {
  const { inicio, fim, status = "ENTREGUE" } = req.query;
  const { ini, end } = rangeFromDates(inicio, fim);

  const where = [];
  const params = [];
  let paramIndex = 1;

  if (ini && end) {
    where.push(`p.createdat BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
    params.push(ini, end);
    paramIndex += 2;
  } else if (ini) {
    where.push(`p.createdat >= $${paramIndex}`);
    params.push(ini);
    paramIndex++;
  } else if (end) {
    where.push(`p.createdat <= $${paramIndex}`);
    params.push(end);
    paramIndex++;
  }

  if (status && status !== "TODOS") {
    where.push(`p.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `
    SELECT
      pr.id as "produtoId",
      pr.nome as "produtoNome",
      COALESCE(SUM(pi.qtd), 0) as "qtdVendida",
      COALESCE(SUM(pi.precocentavos * pi.qtd), 0) as "totalCentavos"
    FROM pedido_itens pi
    JOIN pedidos p ON p.id = pi.pedidoid
    JOIN produtos pr ON pr.id = pi.produtoid
    ${whereSql}
    GROUP BY pr.id, pr.nome
    ORDER BY "totalCentavos" DESC, "qtdVendida" DESC
    LIMIT 50
  `;

  try {
    const db = getDB();
    const result = await db.query(sql, params);
    res.json(result.rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /relatorios/pedidos?inicio=YYYY-MM-DD&fim=YYYY-MM-DD&status=ENTREGUE|TODOS
router.get("/pedidos", requireAdmin, async (req, res) => {
  const { inicio, fim, status = "TODOS" } = req.query;
  const { ini, end } = rangeFromDates(inicio, fim);

  const where = [];
  const params = [];
  let paramIndex = 1;

  if (ini && end) {
    where.push(`p.createdat BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
    params.push(ini, end);
    paramIndex += 2;
  } else if (ini) {
    where.push(`p.createdat >= $${paramIndex}`);
    params.push(ini);
    paramIndex++;
  } else if (end) {
    where.push(`p.createdat <= $${paramIndex}`);
    params.push(end);
    paramIndex++;
  }

  if (status && status !== "TODOS") {
    where.push(`p.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `
    SELECT
      p.id,
      p.clientenome AS "clienteNome",
      p.endereco,
      p.status,
      p.createdat AS "criadoEm",
      (
        SELECT COALESCE(SUM(pi.precocentavos * pi.qtd), 0)
        FROM pedido_itens pi
        WHERE pi.pedidoid = p.id
      ) as "totalCentavos",
      p.troco_para_centavos AS "troco_para_centavos",
      CASE WHEN p.troco_para_centavos IS NOT NULL 
      THEN p.troco_para_centavos - (
        SELECT COALESCE(SUM(pi.precocentavos * pi.qtd), 0)
        FROM pedido_itens pi
        WHERE pi.pedidoid = p.id
      )
      ELSE 0 END as "trocoCentavos",
      COALESCE(p.formapagamento, 'NAO_INFORMADO') as "formaPagamento"
    FROM pedidos p
    ${whereSql}
    ORDER BY p.id DESC
    LIMIT 200
  `;

  try {
    const db = getDB();
    const result = await db.query(sql, params);
    res.json(result.rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;