require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");

const { signToken, requireAuth, requireRole } = require("./auth");
const { initDB, getDB } = require("./db-postgres.js");
const relatoriosRoutes = require("./relatorios");

const app = express();
const PORT = process.env.PORT || 3333;
const HOST = process.env.HOST || "0.0.0.0";

app.use(cors());
app.use(express.json());

// Helper para converter valores em boolean
function parseBool(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["true", "1", "sim", "s", "on"].includes(v)) return true;
    if (["false", "0", "nao", "não", "n", "off"].includes(v)) return false;
  }
  return fallback;
}

// Inicializar banco
initDB().catch((err) => {
  console.error("Erro fatal ao inicializar DB:", err);
  process.exit(1);
});

// Health check
app.get("/", (req, res) => {
  res.json({ ok: true, name: "ETGÁGUA Backend", time: new Date().toISOString() });
});

app.get("/health", (req, res) => {
  res.json({ ok: true, name: "ETGÁGUA Backend", time: new Date().toISOString() });
});

// Relatórios (ADMIN)
app.use("/relatorios", requireAuth, relatoriosRoutes);

// =========================
// PRODUTOS (somente ativos para atendentes)
// =========================
app.get("/produtos", requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const result = await db.query(`
      SELECT id, nome, precocentavos AS "precoCentavos"
      FROM produtos
      WHERE ativo = true
      ORDER BY id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// LOGIN
// =========================
app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "username e password são obrigatórios" });
  }

  try {
    const db = getDB();
    const result = await db.query(
        'SELECT id, username, "passwordHash" as passwordhash, role FROM public.users WHERE username = $1',
      [username]
    );

    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "Usuário ou senha inválidos" });

    const ok = await bcrypt.compare(password, user.passwordhash);
    if (!ok) return res.status(401).json({ error: "Usuário ou senha inválidos" });

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// ADMIN - USERS
// =========================
app.get("/admin/users", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const db = getDB();
    const result = await db.query("SELECT id, username, role FROM users ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/admin/users", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { username, password, role } = req.body || {};

  if (!username || !password || !role) {
    return res.status(400).json({ error: "username, password e role são obrigatórios" });
  }

  if (!["ADMIN", "ATENDENTE", "ENTREGADOR"].includes(role)) {
    return res.status(400).json({ error: "role inválido" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const db = getDB();

    const result = await db.query(
      "INSERT INTO users (username, passwordhash, role) VALUES ($1, $2, $3) RETURNING id, username, role",
      [username, passwordHash, role]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "username já existe" });
    res.status(500).json({ error: err.message });
  }
});

// =========================
// ADMIN - PRODUTOS
// =========================
app.get("/admin/produtos", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const db = getDB();
    const result = await db.query(`
      SELECT id, nome, precocentavos AS "precoCentavos", ativo
      FROM produtos
      ORDER BY id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/admin/produtos", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { nome, precoCentavos, ativo } = req.body || {};
  if (!nome) return res.status(400).json({ error: "nome é obrigatório" });

  let precoFinal = Number(precoCentavos);
  if (!Number.isFinite(precoFinal)) precoFinal = 0;
  if (!Number.isInteger(precoFinal)) precoFinal = Math.round(precoFinal);
  if (precoFinal < 0) return res.status(400).json({ error: "precoCentavos não pode ser negativo" });

  const ativoFinal = parseBool(ativo, true);

  try {
    const db = getDB();
    const result = await db.query(
      `INSERT INTO produtos (nome, precocentavos, ativo)
       VALUES ($1, $2, $3)
       RETURNING id, nome, precocentavos AS "precoCentavos", ativo`,
      [nome, precoFinal, ativoFinal]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/admin/produtos/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "id inválido" });

  const { nome, precoCentavos, ativo } = req.body || {};

  try {
    const db = getDB();
    const atual = await db.query("SELECT * FROM produtos WHERE id = $1", [id]);
    if (atual.rows.length === 0) return res.status(404).json({ error: "Produto não encontrado" });

    const row = atual.rows[0];

    const nomeFinal = nome ?? row.nome;

    let precoFinal = precoCentavos === undefined ? Number(row.precocentavos) : Number(precoCentavos);
    if (!Number.isFinite(precoFinal)) precoFinal = Number(row.precocentavos);
    if (!Number.isInteger(precoFinal)) precoFinal = Math.round(precoFinal);
    if (precoFinal < 0) return res.status(400).json({ error: "precoCentavos não pode ser negativo" });

    const ativoFinal = parseBool(ativo, row.ativo);

    const result = await db.query(
      `UPDATE produtos
       SET nome = $1, precocentavos = $2, ativo = $3
       WHERE id = $4
       RETURNING id, nome, precocentavos AS "precoCentavos", ativo`,
      [nomeFinal, precoFinal, ativoFinal, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// PEDIDOS (listar com itens)
// =========================
app.get("/pedidos", requireAuth, async (req, res) => {
  const { status } = req.query;

  try {
    const db = getDB();

    const pedidos = status
      ? await db.query("SELECT * FROM pedidos WHERE status = $1 ORDER BY id DESC", [status])
      : await db.query("SELECT * FROM pedidos ORDER BY id DESC");

    if (pedidos.rows.length === 0) return res.json([]);

    const ids = pedidos.rows.map((p) => p.id);

    // ✅ traz itens + nome do produto
    const itens = await db.query(
      `
      SELECT
        pi.*,
        pr.nome AS produtonome
      FROM pedido_itens pi
      LEFT JOIN produtos pr ON pr.id = pi.produtoid
      WHERE pi.pedidoid = ANY($1)
      ORDER BY pi.id ASC
      `,
      [ids]
    );

    // Agrupar itens por pedido + calcular subtotal
    const mapItens = new Map();
    for (const it of itens.rows) {
      const pedidoId = it.pedidoid;

      const subtotalCentavos = Number(it.qtd || 0) * Number(it.precocentavos || 0);

      if (!mapItens.has(pedidoId)) mapItens.set(pedidoId, []);
      mapItens.get(pedidoId).push({
        id: it.id,
        pedidoId: it.pedidoid,
        produtoId: it.produtoid,
        produtoNome: it.produtonome || null,
        qtd: it.qtd,
        precoCentavos: it.precocentavos,
        subtotalCentavos, // ✅ agora o front consegue mostrar o valor
      });
    }

    // Montar pedidos + calcular total
    const out = pedidos.rows.map((p) => {
      const itensDoPedido = mapItens.get(p.id) || [];
      const totalCentavos = itensDoPedido.reduce(
        (acc, it) => acc + Number(it.subtotalCentavos || 0),
        0
      );

      return {
        id: p.id,
        clientenome: p.clientenome,
        telefone: p.telefone,
        endereco: p.endereco,
        observacao: p.observacao,
        status: p.status,
        formaPagamento: p.formapagamento,
        troco_para_centavos: p.troco_para_centavos,
        createdAt: p.createdat,
        criadoEm: p.createdat
          ? new Date(p.createdat).toLocaleString("pt-BR")
          : null,

        entregadorId: p.entregadorid,

        totalCentavos, // ✅ agora aparece Total no entregador/atendente
        itens: itensDoPedido,
      };
    });

    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// =========================
// CRIAR PEDIDO (só produtos ativos)
// =========================
app.post("/pedidos", requireAuth, async (req, res) => {
  console.log('📦 POST /pedidos recebido:', req.body); 
  const { clienteNome, telefone, endereco, observacao, itens, troco_para_centavos, formaPagamento } = req.body || {};

  if (!clienteNome || !endereco) {
    return res.status(400).json({ error: "clienteNome e endereco são obrigatórios" });
  }
  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: "itens é obrigatório" });
  }

  const forma = (formaPagamento || "DINHEIRO").toUpperCase();
  if (!["DINHEIRO", "PIX", "CARTAO"].includes(forma)) {
    return res.status(400).json({ error: "formaPagamento inválida" });
  }

  const parsedItens = itens
    .map((i) => ({ produtoId: Number(i.produtoId), qtd: Number(i.qtd) }))
    .filter((i) => Number.isInteger(i.produtoId) && i.produtoId > 0 && Number.isInteger(i.qtd) && i.qtd > 0);

  if (parsedItens.length !== itens.length) {
    return res.status(400).json({ error: "itens inválidos" });
  }

  try {
    const db = getDB();
    const ids = parsedItens.map((i) => i.produtoId);

    const produtos = await db.query(
  `SELECT id, nome, precocentavos AS "precoCentavos"
   FROM public.produtos
   WHERE id = ANY($1) AND ativo = true`,
  [ids]
);
console.log('🔍 Produtos encontrados:', produtos.rows); // ← ADICIONE ESTA LINHA
console.log('🔍 IDs procurados:', ids); // ← E ESTA

    if (produtos.rows.length !== ids.length) {
      return res.status(400).json({ error: "Um ou mais produtos não existem ou estão inativos" });
    }

    const mapProd = new Map(produtos.rows.map((p) => [Number(p.id), p]));

    let trocoPara = troco_para_centavos === null || troco_para_centavos === undefined ? null : Number(troco_para_centavos);
    if (forma !== "DINHEIRO") trocoPara = null;

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      const pedidoResult = await client.query(
  `INSERT INTO public.pedidos ("clienteNome", telefone, endereco, observacao, status, "formaPagamento", troco_para_centavos)
   VALUES ($1, $2, $3, $4, 'ABERTO', $5, $6)
   RETURNING *`,
  [clienteNome, telefone, endereco, observacao, forma, trocoPara]
);
      
      const pedidoId = pedidoResult.rows[0].id;

      for (const it of parsedItens) {
        const p = mapProd.get(it.produtoId);
        const precoUnit = Number(p.precoCentavos);

       await client.query(
        `INSERT INTO public.pedido_itens ("pedidoId", "produtoId", "produtoNome", qtd, "precoUnitCentavos", "subtotalCentavos", precocentavos)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [pedidoId, it.produtoId, p.nome, it.qtd, precoUnit, precoUnit * it.qtd, precoUnit]
      );
      }

      await client.query("COMMIT");

      const final = await db.query("SELECT * FROM public.pedidos WHERE id = $1", [pedidoId]);
      const itensResult = await db.query("SELECT * FROM public.pedido_itens WHERE pedidoId = $1", [pedidoId]);

      const outPedido = final.rows[0];
      const outItens = itensResult.rows.map((it) => ({
        id: it.id,
        pedidoId: it.pedidoid,
        produtoId: it.produtoid,
        qtd: it.qtd,
        precoCentavos: it.precocentavos,
      }));

      res.status(201).json({
        id: outPedido.id,
        clienteNome: outPedido.clientenome,
        telefone: outPedido.telefone,
        endereco: outPedido.endereco,
        observacao: outPedido.observacao,
        status: outPedido.status,
        formaPagamento: outPedido.formapagamento,
        troco_para_centavos: outPedido.troco_para_centavos,
        createdAt: outPedido.createdat,
        itens: outItens,
      });
    } catch (err) {
      console.error('❌ ERRO POST /pedidos:', err);
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ ERRO GERAL:', err);
    res.status(500).json({ error: err.message });
  }
});

// =========================
// ATUALIZAR STATUS DO PEDIDO
// =========================
app.patch("/pedidos/:id/status", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  const allowed = ["ABERTO", "EM_ROTA", "ENTREGUE", "CANCELADO"];

  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "id inválido" });
  if (!status || !allowed.includes(status)) return res.status(400).json({ error: "status inválido", allowed });

  try {
    const db = getDB();
    const result = await db.query(
      "UPDATE pedidos SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Pedido não encontrado" });

    const p = result.rows[0];
    res.json({
      id: p.id,
      clientenome: p.clientenome,
      telefone: p.telefone,
      endereco: p.endereco,
      observacao: p.observacao,
      status: p.status,
      formaPagamento: p.formapagamento,
      troco_para_centavos: p.troco_para_centavos,
      createdAt: p.createdat,
      entregadorId: p.entregadorid,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== CLIENTES =====
// ===== CLIENTES =====

// LISTAR (só ativos)
app.get("/clientes", requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const result = await db.query(`
      SELECT
        id,
        codigo,
        nome,
        endereco,
        ponto_referencia,
        telefone,
        cpf,
        ativo,
        createdat
      FROM public.clientes
      WHERE ativo = true
      ORDER BY nome
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /clientes error:", err);
    res.status(500).json({ error: err.message });
  }
});

// CADASTRAR
app.post("/clientes", requireAuth, async (req, res) => {
  const { nome, endereco, ponto_referencia, telefone, cpf } = req.body || {};

  if (!nome || !endereco) {
    return res.status(400).json({ error: "nome e endereco são obrigatórios" });
  }

  try {
    const db = getDB();
    const codigo = `CLI${Date.now()}`;

    const result = await db.query(
      `INSERT INTO public.clientes (codigo, nome, endereco, ponto_referencia, telefone, cpf, ativo)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, codigo, nome, endereco, ponto_referencia, telefone, cpf, ativo, createdat`,
      [codigo, nome, endereco, ponto_referencia || null, telefone || null, cpf || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /clientes error:", err);
    res.status(500).json({ error: err.message });
  }
});

// EDITAR
app.patch("/clientes/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "id inválido" });

  const { nome, endereco, ponto_referencia, telefone, cpf } = req.body || {};

  try {
    const db = getDB();
    const result = await db.query(
      `
      UPDATE clientes
      SET nome = COALESCE($1, nome),
          endereco = COALESCE($2, endereco),
          ponto_referencia = COALESCE($3, ponto_referencia),
          telefone = COALESCE($4, telefone),
          cpf = COALESCE($5, cpf)
      WHERE id = $6
      RETURNING
        id, codigo, nome, endereco,
        ponto_referencia AS "ponto_referencia",
        telefone, cpf, ativo,
        created_at AS "createdAt"
      `,
      [nome ?? null, endereco ?? null, ponto_referencia ?? null, telefone ?? null, cpf ?? null, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: "Cliente não encontrado" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error("PATCH /clientes/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

// "DELETAR" (soft delete)
app.delete("/clientes/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "id inválido" });

  try {
    const db = getDB();
    const result = await db.query("UPDATE clientes SET ativo = false WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Cliente não encontrado" });

    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /clientes/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});
  
// ROTA DE MIGRAÇÃO - ADICIONAR COLUNA ponto_referencia
app.get("/migrate/add-ponto_referencia", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const db = getDB();
    
    // Tentar adicionar a coluna
    await db.query(`
      ALTER TABLE clientes 
      ADD COLUMN IF NOT EXISTS "ponto_referencia" TEXT
    `);
    
    res.json({ 
      success: true, 
      message: "Coluna ponto_referencia adicionada com sucesso!" 
    });
  } catch (err) {
    console.error("Erro na migração:", err);
    res.status(500).json({ error: err.message });
  }
});



app.listen(PORT, HOST, () => {
  console.log(`🚀 ETGÁGUA Backend rodando em http://${HOST}:${PORT}`);
  console.log(`📡 Acesse de outros dispositivos usando o IP da máquina na porta ${PORT}`);
});