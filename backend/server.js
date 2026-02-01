require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { signToken, requireAuth, requireRole } = require("./auth");
const { initDB, getDB } = require("./db-postgres");
const relatoriosRoutes = require("./relatorios");

const app = express();

const PORT = process.env.PORT || 3333;
const HOST = process.env.HOST || "0.0.0.0";

app.use(cors());
app.use(express.json());

// Inicializar banco
initDB().catch(err => {
  console.error('Erro fatal ao inicializar DB:', err);
  process.exit(1);
});

// Health check
app.get("/", (req, res) => {
  res.json({ ok: true, name: "ETGÁGUA Backend", time: new Date().toISOString() });
});

app.get("/health", (req, res) => {
  res.json({ ok: true, name: "ETGÁGUA Backend", time: new Date().toISOString() });
});

// ===== MIGRAÇÃO TEMPORÁRIA - REMOVER DEPOIS =====
app.get("/migrate/add-ativo", async (req, res) => {
  try {
    const db = getDB();
    
    // Adicionar coluna
    await db.query(`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS ativo INTEGER DEFAULT 1`);
    
    // Atualizar produtos existentes
    await db.query(`UPDATE produtos SET ativo = 1 WHERE ativo IS NULL`);
    
    // Verificar
    const result = await db.query(`SELECT * FROM produtos`);
    
    res.json({ 
      success: true, 
      message: "Coluna ativo adicionada com sucesso!",
      produtos: result.rows 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ================================================

// Relatórios
app.use("/relatorios", requireAuth, relatoriosRoutes);

// Produtos ativos
app.get("/produtos", requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const result = await db.query(
      "SELECT id, nome, precoCentavos FROM produtos WHERE ativo = 1 ORDER BY id DESC" // ← FILTRO AQUI
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: "username e password são obrigatórios" });
  }

  try {
    const db = getDB();
    const result = await db.query(
      "SELECT id, username, passwordHash, role FROM users WHERE username = $1",
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

// Admin - Users
app.get("/admin/users", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const db = getDB();
    const result = await db.query(
      "SELECT id, username, role FROM users ORDER BY id DESC"
    );
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
      "INSERT INTO users (username, passwordHash, role) VALUES ($1, $2, $3) RETURNING *",
      [username, passwordHash, role]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      return res.status(409).json({ error: "username já existe" });
    }
    res.status(500).json({ error: err.message });
  }
});

// Admin - Produtos
app.get("/admin/produtos", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const db = getDB();
    const result = await db.query("SELECT * FROM produtos ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/admin/produtos", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { nome, precoCentavos } = req.body || {};

  if (!nome) return res.status(400).json({ error: "nome é obrigatório" });

  let precoFinal = Number(precoCentavos);
  if (!Number.isFinite(precoFinal)) precoFinal = 0;
  if (!Number.isInteger(precoFinal)) precoFinal = Math.round(precoFinal);
  if (precoFinal < 0) return res.status(400).json({ error: "precoCentavos não pode ser negativo" });

  try {
    const db = getDB();
    const result = await db.query(
      "INSERT INTO produtos (nome, precoCentavos) VALUES ($1, $2) RETURNING *",
      [nome, precoFinal]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/admin/produtos/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "id inválido" });

  const { nome, precoCentavos } = req.body || {};

  try {
    const db = getDB();
    
    const atual = await db.query("SELECT * FROM produtos WHERE id = $1", [id]);
    if (atual.rows.length === 0) return res.status(404).json({ error: "Produto não encontrado" });

    const nomeFinal = nome ?? atual.rows[0].nome;
    let precoFinal = precoCentavos === undefined ? atual.rows[0].precocentavos : Number(precoCentavos);
    
    if (!Number.isFinite(precoFinal)) precoFinal = atual.rows[0].precocentavos;
    if (!Number.isInteger(precoFinal)) precoFinal = Math.round(precoFinal);
    if (precoFinal < 0) return res.status(400).json({ error: "precoCentavos não pode ser negativo" });

    const result = await db.query(
      "UPDATE produtos SET nome = $1, precoCentavos = $2 WHERE id = $3 RETURNING *",
      [nomeFinal, precoFinal, id]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pedidos (listar com itens)
app.get("/pedidos", requireAuth, async (req, res) => {
  const { status } = req.query;

  try {
    const db = getDB();
    
    let pedidos;
    if (status) {
      pedidos = await db.query("SELECT * FROM pedidos WHERE status = $1 ORDER BY id DESC", [status]);
    } else {
      pedidos = await db.query("SELECT * FROM pedidos ORDER BY id DESC");
    }

    if (pedidos.rows.length === 0) return res.json([]);

    const ids = pedidos.rows.map(p => p.id);
    const itens = await db.query(
      "SELECT * FROM pedido_itens WHERE pedidoId = ANY($1) ORDER BY id ASC",
      [ids]
    );

    const map = new Map();
    for (const it of itens.rows) {
      if (!map.has(it.pedidoid)) map.set(it.pedidoid, []);
      map.get(it.pedidoid).push(it);
    }

    const out = pedidos.rows.map(p => ({ ...p, itens: map.get(p.id) || [] }));
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criar pedido
app.post("/pedidos", requireAuth, async (req, res) => {
  const { clienteNome, telefone, endereco, observacao, itens, trocoParaCentavos, formaPagamento } = req.body || {};

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
    .map(i => ({ produtoId: Number(i.produtoId), qtd: Number(i.qtd) }))
    .filter(i => Number.isInteger(i.produtoId) && i.produtoId > 0 && Number.isInteger(i.qtd) && i.qtd > 0);

  if (parsedItens.length !== itens.length) {
    return res.status(400).json({ error: "itens inválidos" });
  }

  try {
    const db = getDB();
    const ids = parsedItens.map(i => i.produtoId);
    
    const produtos = await db.query(
      "SELECT id, nome, precoCentavos FROM produtos WHERE id = ANY($1)",
      [ids]
    );

    if (produtos.rows.length !== ids.length) {
      return res.status(400).json({ error: "Um ou mais produtos não existem" });
    }

    const mapProd = new Map(produtos.rows.map(p => [p.id, p]));

    let totalCentavos = 0;
    for (const it of parsedItens) {
      const p = mapProd.get(it.produtoId);
      totalCentavos += Number(p.precocentavos) * it.qtd;
    }

    let trocoPara = trocoParaCentavos === null || trocoParaCentavos === undefined ? null : Number(trocoParaCentavos);
    if (forma !== "DINHEIRO") trocoPara = null;

    const client = await db.connect();
    
    try {
      await client.query('BEGIN');

      const pedidoResult = await client.query(
        "INSERT INTO pedidos (clienteNome, telefone, endereco, observacao, status, formaPagamento, trocoParaCentavos) VALUES ($1, $2, $3, $4, 'ABERTO', $5, $6) RETURNING *",
        [clienteNome, telefone || "", endereco, observacao || "", forma, trocoPara]
      );

      const pedidoId = pedidoResult.rows[0].id;

      for (const it of parsedItens) {
        const p = mapProd.get(it.produtoId);
        const precoUnit = Number(p.precocentavos);
        
        await client.query(
          "INSERT INTO pedido_itens (pedidoId, produtoId, qtd, precoCentavos) VALUES ($1, $2, $3, $4)",
          [pedidoId, it.produtoId, it.qtd, precoUnit]
        );
      }

      await client.query('COMMIT');

      const final = await db.query("SELECT * FROM pedidos WHERE id = $1", [pedidoId]);
      const itensResult = await db.query("SELECT * FROM pedido_itens WHERE pedidoId = $1", [pedidoId]);

      res.status(201).json({ ...final.rows[0], itens: itensResult.rows });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar status
app.patch("/pedidos/:id/status", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  const allowed = ["ABERTO", "EM_ROTA", "ENTREGUE", "CANCELADO"];

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "id inválido" });
  }

  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ error: "status inválido", allowed });
  }

  try {
    const db = getDB();
    const result = await db.query(
      "UPDATE pedidos SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`🚀 ETGÁGUA Backend rodando em http://${HOST}:${PORT}`);
  console.log(`📡 Acesse de outros dispositivos usando o IP da máquina na porta ${PORT}`);
});