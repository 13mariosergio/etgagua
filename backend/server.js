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

// ✅ ESSE É O CERTO — alias PATCH /pedidos/:id/status e /api/pedidos/:id/status
function attachPedidosStatusRoutes(basePath = "") {
  app.patch(`${basePath}/pedidos/:id/status`, requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body || {};
    const allowed = ["ABERTO", "EM_ROTA", "ENTREGUE", "CANCELADO"];

    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "id inválido" });
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ error: "status inválido", allowed });
    }

    try {
      const db = getDB();
      const result = await db.query(
        `UPDATE pedidos
         SET status = $1
         WHERE id = $2
         RETURNING
           id,
           "clienteNome",
           telefone,
           endereco,
           observacao,
           status,
           "formaPagamento",
           troco_para_centavos,
           createdat,
           entregadorid`,
        [status, id]
      );

      if (result.rows.length === 0) return res.status(404).json({ error: "Pedido não encontrado" });

      const p = result.rows[0];

      return res.json({
        id: p.id,
        clientenome: p.clienteNome,
        telefone: p.telefone,
        endereco: p.endereco,
        observacao: p.observacao,
        status: p.status,
        formaPagamento: p.formaPagamento,
        troco_para_centavos: p.troco_para_centavos,
        createdAt: p.createdat,
        entregadorId: p.entregadorid,
      });
    } catch (err) {
      console.error(`PATCH ${basePath}/pedidos/:id/status error:`, err);
      return res.status(500).json({ error: err.message });
    }
  });
}

attachPedidosStatusRoutes("");      // /pedidos/:id/status
attachPedidosStatusRoutes("/api");  // /api/pedidos/:id/status


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
      'INSERT INTO public.users (username, "passwordHash", role) VALUES ($1, $2, $3) RETURNING id, username, role',
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
// =========================
// PEDIDOS (listar com itens) - via VIEW public.pedidos_api
// ✅ ESSE É O CERTO — POST /pedidos (Supabase) + itens
app.post("/pedidos", requireAuth, async (req, res) => {
  res.set("Cache-Control", "no-store");

  const db = getDB();
  const {
    clienteNome,
    telefone,
    endereco,
    observacao,
    formaPagamento,
    trocoParaCentavos,
    itens,
  } = req.body || {};

  const fp = String(formaPagamento || "").trim().toUpperCase();
  const allowedFP = ["DINHEIRO", "PIX", "CARTAO"];
  if (!allowedFP.includes(fp)) {
    return res.status(400).json({ error: "formaPagamento inválida", allowed: allowedFP });
  }

  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: "Informe ao menos 1 item." });
  }

  const trocoPara =
    trocoParaCentavos === null || trocoParaCentavos === undefined || trocoParaCentavos === ""
      ? null
      : Number(trocoParaCentavos);

  if (trocoPara !== null && (!Number.isFinite(trocoPara) || trocoPara < 0)) {
    return res.status(400).json({ error: "trocoParaCentavos inválido." });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // 1) Carrega preços atuais dos produtos
    const ids = itens.map((i) => Number(i.produtoId)).filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length !== itens.length) {
      return res.status(400).json({ error: "itens[].produtoId inválido." });
    }
      // ✅ ESSE É O CERTO — valida telefone (porque no banco é NOT NULL)
        const telefone = String(
        req.body?.telefone ??
        req.body?.clienteFone ??
        ""
      ).trim();

      const rProd = await client.query(
      `SELECT id, nome, precoCentavos
         FROM produtos
        WHERE id = ANY($1::int[]) AND ativo = true`,
      [ids]
    );

    if (rProd.rowCount !== ids.length) {
      return res.status(400).json({ error: "Algum produto não existe ou está inativo." });
    }

    const byId = new Map(rProd.rows.map((p) => [Number(p.id), p]));

    // 2) Monta itens com subtotal
    const itensCalc = itens.map((i) => {
      const produtoId = Number(i.produtoId);
      const qtd = Number(i.qtd);

      if (!Number.isFinite(qtd) || qtd <= 0) throw new Error("QTD_INVALIDA");

      const p = byId.get(produtoId);
      const precoUnitCentavos = Number(p.precocentavos ?? p.precoCentavos ?? 0);
      const subtotalCentavos = precoUnitCentavos * qtd;

      return {
        produtoId,
        produtoNome: p.nome,
        qtd,
        precoUnitCentavos,
        subtotalCentavos,
      };
    });

    const totalCentavos = itensCalc.reduce((acc, it) => acc + it.subtotalCentavos, 0);

    // 3) Troco real
    let trocoCentavos = null;
    if (fp === "DINHEIRO" && trocoPara !== null) {
      if (trocoPara < totalCentavos) {
        return res.status(400).json({ error: "trocoParaCentavos menor que o total." });
      }
      trocoCentavos = trocoPara - totalCentavos;
    }

    // 4) Insere pedido
    // ⚠️ IMPORTANTÍSSIMO: sua VIEW usa p.createdat e p.troco_para_centavos
  const rPedido = await client.query(
  `INSERT INTO pedidos
    ("clienteNome", telefone, endereco, observacao, status,
     "formaPagamento", troco_para_centavos, createdat)
   VALUES
    ($1, $2, $3, $4, 'ABERTO', $5, $6, NOW())
   RETURNING
    id, status, "clienteNome", telefone, endereco, observacao,
    "formaPagamento", troco_para_centavos, createdat`,
  [
    String(clienteNome || "").trim() || "",
    telefone, // ✅ NUNCA null
    String(endereco || "").trim() || "",
    String(observacao || "").trim() || "",
    fp,
    fp === "DINHEIRO" ? trocoPara : null,
  ]
);



    const pedido = rPedido.rows[0];

    // 5) Insere itens
    for (const it of itensCalc) {
      await client.query(
        `INSERT INTO pedido_itens
          ("pedidoId", "produtoId", "produtoNome", qtd, "precoUnitCentavos", "subtotalCentavos")
         VALUES
          ($1, $2, $3, $4, $5, $6)`,
        [pedido.id, it.produtoId, it.produtoNome, it.qtd, it.precoUnitCentavos, it.subtotalCentavos]
      );
    }

    await client.query("COMMIT");

    


    // 6) Resposta padronizada (compat com seu GET/view)
    return res.status(201).json({
      id: pedido.id,
      status: pedido.status,
      clienteNome: pedido.clienteNome,
      telefone: pedido.telefone,
      endereco: pedido.endereco,
      observacao: pedido.observacao,
      formaPagamento: pedido.formaPagamento,
      trocoParaCentavos: pedido.troco_para_centavos,
      totalCentavos,
      trocoCentavos,
      criadoEm: pedido.createdat,
      itens: itensCalc,
    });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("❌ POST /pedidos ERRO:", err);

    if (String(err?.message) === "QTD_INVALIDA") {
      return res.status(400).json({ error: "itens[].qtd inválida (deve ser > 0)." });
    }

    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ✅ ESSE É O CERTO — alias para o front funcionar com /pedidos e /api/pedidos

function attachPedidosRoutes(basePath = "") {
  app.get(`${basePath}/pedidos`, requireAuth, async (req, res) => {
    res.set("Cache-Control", "no-store");

    const { status } = req.query;

    try {
      const db = getDB();

      const qBase = `
        SELECT
          id,
          "clienteNome",
          telefone,
          endereco,
          observacao,
          status,
          "formaPagamento",
          "trocoParaCentavos",
          "totalCentavos",
          "criadoEm",
          itens
        FROM public.pedidos_api
        ${status ? "WHERE status = $1" : ""}
        ORDER BY id DESC
      `;

      const result = status ? await db.query(qBase, [status]) : await db.query(qBase);

      const out = result.rows.map((p) => {
        const itens = Array.isArray(p.itens) ? p.itens : [];

        const totalFromItens = itens.reduce((acc, it) => {
          const sub =
            it?.subtotalCentavos ??
            it?.subtotal_centavos ??
            (Number(it?.qtd || 0) * Number(it?.precoUnitCentavos ?? it?.preco_unit_centavos ?? 0));
          return acc + Number(sub || 0);
        }, 0);

        const totalCentavos =
          Number(p.totalCentavos || 0) > 0 ? Number(p.totalCentavos) : totalFromItens;

        const forma = String(p.formaPagamento || "").toUpperCase();
        const trocoPara =
          p.trocoParaCentavos === null || p.trocoParaCentavos === undefined
            ? null
            : Number(p.trocoParaCentavos);

        let trocoCentavos = null;
        if (forma === "DINHEIRO" && trocoPara !== null) {
          trocoCentavos = Math.max(0, trocoPara - totalCentavos);
        }

        return {
          id: p.id,
          clientenome: p.clienteNome,
          telefone: p.telefone,
          endereco: p.endereco,
          observacao: p.observacao,
          status: p.status,
          formaPagamento: p.formaPagamento,
          troco_para_centavos: trocoPara,
          trocoParaCentavos: trocoPara,
          totalCentavos,
          trocoCentavos,
          createdAt: p.criadoEm,
          criadoEm: p.criadoEm ? new Date(p.criadoEm).toLocaleString("pt-BR") : null,
          itens,
        };
      });

      res.json(out);
    } catch (err) {
      console.error(`GET ${basePath}/pedidos error:`, err);
      res.status(500).json({ error: err.message });
    }
  });
}

// registra as duas rotas:
attachPedidosRoutes("");      // /pedidos
attachPedidosRoutes("/api");  // /api/pedidos


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

// =====================================================
// ADICIONE ESTAS ROTAS NO server.js
// =====================================================
// Cole ANTES da linha "INICIAR SERVIDOR COM WEBSOCKET"

// =========================
// 📦 BACKUP DE DADOS
// =========================

// EXPORTAR BACKUP (Download JSON)
app.get("/admin/backup/export", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const db = getDB();
    
    // Buscar todos os dados
    const usuarios = await db.query('SELECT id, username, role FROM public.users ORDER BY id');
    const clientes = await db.query('SELECT * FROM public.clientes WHERE ativo = true ORDER BY id');
    const produtos = await db.query('SELECT * FROM public.produtos ORDER BY id');
    const pedidos = await db.query('SELECT * FROM public.pedidos ORDER BY id DESC LIMIT 1000');
    const pedidoItens = await db.query('SELECT * FROM public.pedido_itens ORDER BY id');

    const backup = {
      metadata: {
        version: "1.0",
        exportDate: new Date().toISOString(),
        exportedBy: req.user.username,
        sistema: "ETGÁGUA"
      },
      data: {
        usuarios: usuarios.rows,
        clientes: clientes.rows,
        produtos: produtos.rows,
        pedidos: pedidos.rows,
        pedidoItens: pedidoItens.rows
      },
      stats: {
        totalUsuarios: usuarios.rows.length,
        totalClientes: clientes.rows.length,
        totalProdutos: produtos.rows.length,
        totalPedidos: pedidos.rows.length
      }
    };

    // Definir headers para download
    const filename = `etgagua-backup-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.json(backup);
    
    console.log(`✅ Backup exportado por ${req.user.username} - ${backup.stats.totalClientes} clientes, ${backup.stats.totalProdutos} produtos`);
  } catch (err) {
    console.error('❌ Erro ao exportar backup:', err);
    res.status(500).json({ error: err.message });
  }
});

// IMPORTAR BACKUP (Restaurar de JSON)
app.post("/admin/backup/import", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { backup, mode } = req.body;
  
  if (!backup || !backup.data) {
    return res.status(400).json({ error: "Backup inválido" });
  }

  try {
    const db = getDB();
    const client = await db.connect();
    
    let importados = {
      clientes: 0,
      produtos: 0,
      usuarios: 0
    };

    try {
      await client.query("BEGIN");

      // IMPORTAR CLIENTES (APPEND ou REPLACE)
      if (backup.data.clientes && backup.data.clientes.length > 0) {
        if (mode === 'replace') {
          await client.query('DELETE FROM public.clientes');
        }
        
        for (const cliente of backup.data.clientes) {
          const existe = await client.query(
            'SELECT id FROM public.clientes WHERE codigo = $1',
            [cliente.codigo]
          );

          if (existe.rows.length === 0) {
            await client.query(
              `INSERT INTO public.clientes (codigo, nome, endereco, ponto_referencia, telefone, cpf, ativo, createdat)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (codigo) DO NOTHING`,
              [
                cliente.codigo,
                cliente.nome,
                cliente.endereco,
                cliente.ponto_referencia || null,
                cliente.telefone || null,
                cliente.cpf || null,
                cliente.ativo !== false,
                cliente.createdat || new Date()
              ]
            );
           
                  await client.query("BEGIN");

                      const pedidoResult = await client.query(
                `INSERT INTO public.pedidos
                ("clienteNome", telefone, endereco, observacao, status, formapagamento, troco_para_centavos)
                VALUES ($1, $2, $3, $4, 'ABERTO', $5, $6)
                RETURNING *`,
                  [
                    clienteNome,
                    telefone || null,
                    endereco,
                    observacao || null,
                    formaPagamento,
                    troco_para_centavos ?? null,
                  ]
                );


                const pedidoId = pedidoResult.rows[0].id;


              for (const it of parsedItens) {
                const p = mapProd.get(it.produtoId);
                const precoUnit = Number(p.precoCentavos);

                await client.query(
                  `INSERT INTO public.pedido_itens
                  (pedidoid, produtoid, produtonome, qtd, precounitcentavos, precocentavos)
                  VALUES ($1, $2, $3, $4, $5, $6)`,
                  [pedidoId, it.produtoId, p.nome, it.qtd, precoUnit, precoUnit]
                );
              }

            importados.clientes++;           

          }
        }
      }

      // IMPORTAR PRODUTOS (APPEND ou REPLACE)
      if (backup.data.produtos && backup.data.produtos.length > 0) {
        if (mode === 'replace') {
          await client.query('DELETE FROM public.produtos');
        }

        for (const produto of backup.data.produtos) {
          const existe = await client.query(
            'SELECT id FROM public.produtos WHERE nome = $1',
            [produto.nome]
          );

          if (existe.rows.length === 0 || mode === 'replace') {
            await client.query(
              `INSERT INTO public.produtos (nome, "precoCentavos", ativo)
               VALUES ($1, $2, $3)
               ON CONFLICT DO NOTHING`,
              [
                produto.nome,
                produto.precoCentavos || produto.precocentavos || 0,
                produto.ativo !== false
              ]
            );
            importados.produtos++;
          }
        }
      }

      await client.query("COMMIT");

      console.log(`✅ Backup importado por ${req.user.username} - ${importados.clientes} clientes, ${importados.produtos} produtos`);

      res.json({
        success: true,
        message: "Backup importado com sucesso!",
        importados
      });

    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

  } catch (err) {
    console.error('❌ Erro ao importar backup:', err);
    res.status(500).json({ error: err.message });
  }
});

// LISTAR HISTÓRICO DE BACKUPS (simulado - baseado em logs)
app.get("/admin/backup/history", requireAuth, requireRole("ADMIN"), async (req, res) => {
  // Por enquanto retorna vazio - pode ser implementado com tabela de logs depois
  res.json([]);
});


app.listen(PORT, HOST, () => {
  console.log(`🚀 ETGÁGUA Backend rodando em http://${HOST}:${PORT}`);
  console.log(`📡 Acesse de outros dispositivos usando o IP da máquina na porta ${PORT}`);
});