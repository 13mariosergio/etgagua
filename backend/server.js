require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const webpush = require("web-push");

const { signToken, requireAuth, requireRole } = require("./auth");
const { initDB, getDB } = require("./db-postgres.js");
const relatoriosRoutes = require("./relatorios");

// --------------------
// WEB PUSH
// --------------------
const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  "BCoKN2gFcTM4LSKbNPaDY0Ums-ztCIrUjYPFDYlclKOnso4-AAFBHUJlBzId74eFn9nIUZcnvm2HhMhQRvuodEI";
const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  "cFKGlR2c22SgpVKYyqKt1fy-bZIVhLvduA1YlaDUu_Q";

webpush.setVapidDetails(
  "mailto:contato@etgagua.com.br",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
);

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

// --------------------
// Inicializar banco
// --------------------
initDB().catch((err) => {
  console.error("Erro fatal ao inicializar DB:", err);
  process.exit(1);
});

// --------------------
// HEALTH
// --------------------
app.get("/", (req, res) =>
  res.json({
    ok: true,
    name: "ETGÁGUA Backend",
    time: new Date().toISOString(),
  }),
);
app.get("/health", (req, res) =>
  res.json({
    ok: true,
    name: "ETGÁGUA Backend",
    time: new Date().toISOString(),
  }),
);

// Relatórios (ADMIN)
app.use("/relatorios", requireAuth, relatoriosRoutes);

// --------------------
// PUSH: NOTIFICAR ENTREGADORES
// --------------------
async function notifyEntregadores(pedido) {
  try {
    const db = getDB();

    // ✅ sua tabela é public.users (plural)
    const result = await db.query(`
      SELECT s.endpoint, s.p256dh, s.auth
      FROM push_subscriptions s
      JOIN public.users u ON u.id = s.user_id
      WHERE u.role IN ('ENTREGADOR', 'ADMIN')
    `);

    const cliente = pedido.clienteNome ?? pedido.clientenome ?? "Cliente";
    const endereco = pedido.endereco ?? "";

    const payload = JSON.stringify({
      title: "🚚 Novo Pedido!",
      body: `Cliente: ${cliente}\nEndereço: ${endereco}`,
      url: "/entregador",
    });

    const notifications = result.rows.map((sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };

      return webpush
        .sendNotification(pushSubscription, payload)
        .catch(async (err) => {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await db.query(
              "DELETE FROM push_subscriptions WHERE endpoint = $1",
              [sub.endpoint],
            );
          }
          console.error("Erro ao enviar push:", err.statusCode);
        });
    });

    await Promise.all(notifications);
  } catch (err) {
    console.error("Erro notifyEntregadores:", err.message);
  }
}

// --------------------
// ROTAS PUSH
// --------------------
app.post("/notifications/subscribe", requireAuth, async (req, res) => {
  const subscription = req.body;
  const userId = req.user.id;

  try {
    const db = getDB();
    await db.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE
       SET user_id = $1, p256dh = $3, auth = $4`,
      [
        userId,
        subscription.endpoint,
        subscription.keys.p256dh,
        subscription.keys.auth,
      ],
    );
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/notifications/unsubscribe", requireAuth, async (req, res) => {
  const { endpoint } = req.body;
  try {
    const db = getDB();
    await db.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [
      endpoint,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------------
// STATUS PEDIDOS (alias / e /api)
// --------------------
function attachPedidosStatusRoutes(basePath = "") {
  app.patch(`${basePath}/pedidos/:id/status`, requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body || {};
    const allowed = ["ABERTO", "EM_ROTA", "ENTREGUE", "CANCELADO"];

    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ error: "id inválido" });
    if (!status || !allowed.includes(status))
      return res.status(400).json({ error: "status inválido", allowed });

    try {
      const db = getDB();

      const result = await db.query(
        `
        UPDATE pedidos
        SET status = $1
        WHERE id = $2
        RETURNING
          id,
          COALESCE(clientenome, clientenome) AS clienteome,
          telefone,
          endereco,
          observacao,
          status,
          COALESCE(formaPagamento, formapagamento) AS "formaPagamento",
          trocoParaCentavos,
          createdat,
          entregadorid
        `,
        [status, id],
      );

      if (result.rows.length === 0)
        return res.status(404).json({ error: "Pedido não encontrado" });
      return res.json(result.rows[0]);
    } catch (err) {
      console.error(`PATCH ${basePath}/pedidos/:id/status error:`, err.message);
      return res.status(500).json({ error: err.message });
    }
  });
}
attachPedidosStatusRoutes("");
attachPedidosStatusRoutes("/api");

// --------------------
// PRODUTOS (ativos)
// --------------------
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

// --------------------
// LOGIN (tabela public.users)
// --------------------
app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res
      .status(400)
      .json({ error: "username e password são obrigatórios" });

  try {
    const db = getDB();

    const result = await db.query(
      `SELECT id, username, "passwordHash" AS passwordhash, role
       FROM public.users
       WHERE username = $1`,
      [username],
    );

    const user = result.rows[0];
    if (!user)
      return res.status(401).json({ error: "Usuário ou senha inválidos" });

    const ok = await bcrypt.compare(password, user.passwordhash);
    if (!ok)
      return res.status(401).json({ error: "Usuário ou senha inválidos" });

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
// ADMIN - USERS + PRODUTOS (com alias /api)
// =========================
function attachAdminRoutes(basePath = "") {
  // ---- USERS
  app.get(
    `${basePath}/admin/users`,
    requireAuth,
    requireRole("ADMIN"),
    async (req, res) => {
      try {
        const db = getDB();
        const result = await db.query(
          `SELECT id, username, role FROM public.users ORDER BY id DESC`,
        );
        res.json(result.rows);
      } catch (err) {
        console.error("ADMIN USERS GET error:", err.message);
        res.status(500).json({ error: err.message });
      }
    },
  );

  app.post(
    `${basePath}/admin/users`,
    requireAuth,
    requireRole("ADMIN"),
    async (req, res) => {
      const { username, password, role } = req.body || {};

      if (!username || !password || !role) {
        return res
          .status(400)
          .json({ error: "username, password e role são obrigatórios" });
      }
      if (!["ADMIN", "ATENDENTE", "ENTREGADOR"].includes(role)) {
        return res.status(400).json({ error: "role inválido" });
      }

      try {
        const passwordHash = await bcrypt.hash(password, 10);
        const db = getDB();

        const result = await db.query(
          `INSERT INTO public.users (username, "passwordHash", role)
         VALUES ($1, $2, $3)
         RETURNING id, username, role`,
          [username, passwordHash, role],
        );

        res.status(201).json(result.rows[0]);
      } catch (err) {
        if (err.code === "23505")
          return res.status(409).json({ error: "username já existe" });
        console.error("ADMIN USERS POST error:", err.message);
        res.status(500).json({ error: err.message });
      }
    },
  );

  // ---- PRODUTOS
  app.get(
    `${basePath}/admin/produtos`,
    requireAuth,
    requireRole("ADMIN"),
    async (req, res) => {
      try {
        const db = getDB();
        const result = await db.query(`
        SELECT id, nome, precocentavos AS "precoCentavos", ativo
        FROM produtos
        ORDER BY id DESC
      `);
        res.json(result.rows);
      } catch (err) {
        console.error("ADMIN PRODUTOS GET error:", err.message);
        res.status(500).json({ error: err.message });
      }
    },
  );

  app.post(
    `${basePath}/admin/produtos`,
    requireAuth,
    requireRole("ADMIN"),
    async (req, res) => {
      const { nome, precoCentavos, ativo } = req.body || {};
      if (!nome) return res.status(400).json({ error: "nome é obrigatório" });

      let precoFinal = Number(precoCentavos);
      if (!Number.isFinite(precoFinal)) precoFinal = 0;
      precoFinal = Math.round(precoFinal);
      if (precoFinal < 0)
        return res
          .status(400)
          .json({ error: "precoCentavos não pode ser negativo" });

      const ativoFinal = parseBool(ativo, true);

      try {
        const db = getDB();
        const result = await db.query(
          `INSERT INTO produtos (nome, precocentavos, ativo)
         VALUES ($1, $2, $3)
         RETURNING id, nome, precocentavos AS "precoCentavos", ativo`,
          [nome, precoFinal, ativoFinal],
        );
        res.status(201).json(result.rows[0]);
      } catch (err) {
        console.error("ADMIN PRODUTOS POST error:", err.message);
        res.status(500).json({ error: err.message });
      }
    },
  );

  app.patch(
    `${basePath}/admin/produtos/:id`,
    requireAuth,
    requireRole("ADMIN"),
    async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0)
        return res.status(400).json({ error: "id inválido" });

      const { nome, precoCentavos, ativo } = req.body || {};

      try {
        const db = getDB();
        const atual = await db.query(
          `SELECT id, nome, precocentavos, ativo FROM produtos WHERE id = $1`,
          [id],
        );
        if (atual.rows.length === 0)
          return res.status(404).json({ error: "Produto não encontrado" });

        const row = atual.rows[0];

        const nomeFinal = nome ?? row.nome;

        let precoFinal =
          precoCentavos === undefined
            ? Number(row.precocentavos)
            : Number(precoCentavos);
        if (!Number.isFinite(precoFinal))
          precoFinal = Number(row.precocentavos);
        precoFinal = Math.round(precoFinal);
        if (precoFinal < 0)
          return res
            .status(400)
            .json({ error: "precoCentavos não pode ser negativo" });

        const ativoFinal = parseBool(ativo, row.ativo);

        const result = await db.query(
          `UPDATE produtos
         SET nome = $1, precocentavos = $2, ativo = $3
         WHERE id = $4
         RETURNING id, nome, precocentavos AS "precoCentavos", ativo`,
          [nomeFinal, precoFinal, ativoFinal, id],
        );

        res.json(result.rows[0]);
      } catch (err) {
        console.error("ADMIN PRODUTOS PATCH error:", err.message);
        res.status(500).json({ error: err.message });
      }
    },
  );
}

attachAdminRoutes("");
attachAdminRoutes("/api");

// --------------------
// CLIENTES
// --------------------
app.get("/clientes", requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const result = await db.query(
      `SELECT * FROM clientes WHERE ativo = true ORDER BY nome ASC`,
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ ERRO AO CARREGAR CLIENTES:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/clientes", requireAuth, async (req, res) => {
  const { nome, endereco, ponto_referencia, telefone, cpf } = req.body || {};

  if (!nome || !endereco) {
    return res.status(400).json({ error: "Nome e endereço são obrigatórios." });
  }

  try {
    const db = getDB();

    // Gera código único ex: CLI1771234567890
    const codigo = "CLI" + Date.now();

    const result = await db.query(
      `INSERT INTO clientes (codigo, nome, endereco, ponto_referencia, telefone, cpf, ativo)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING *`,
      [
        codigo,
        nome,
        endereco,
        ponto_referencia || "",
        telefone || "",
        cpf || "",
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ ERRO AO CADASTRAR CLIENTE:", err.message);
    res.status(500).json({ error: err.message });
  }
});
// --------------------
// PEDIDOS (listar com itens)
// --------------------
app.get("/pedidos", requireAuth, async (req, res) => {
  const { status } = req.query;

  try {
    const db = getDB();

    const params = [];
    let where = "";
    if (status && status !== "TODOS") {
      params.push(status);
      where = `WHERE p.status = $${params.length}`;
    }

    const result = await db.query(
      `
  SELECT
    p.id,
    p.status,
    p.telefone,
    p.endereco,
    p.observacao,
    p.clientenome AS clientenome,
    p.formapagamento AS "formaPagamento",
    p.trocoParaCentavos AS "trocoParaCentavos",
    p."totalCentavos" AS "totalCentavos",
    p.createdat AS "createdAt",
    COALESCE(
      json_agg(
        json_build_object(
          'id', pi.id,
          'produtoId', pi.produtoid,
          'produtoNome', pi."produtoNome",
          'qtd', pi.qtd,
          'precoCentavos', pi.precocentavos
        )
      ) FILTER (WHERE pi.id IS NOT NULL),
      '[]'::json
    ) AS itens
  FROM pedidos p
  LEFT JOIN pedido_itens pi
    ON p.id = pi.pedidoid
  ${where}
  GROUP BY p.id
  ORDER BY p.createdat DESC
`,
      params,
    );

    const formatado = result.rows.map((p) => {
      const itens = Array.isArray(p.itens) ? p.itens : [];
      const total = itens.reduce(
        (acc, item) =>
          acc + Number(item.qtd || 0) * Number(item.precoCentavos || 0),
        0,
      );
      return { ...p, totalCentavos: total };
    });

    res.json(formatado);
  } catch (err) {
    console.error("ERRO AO LISTAR PEDIDOS:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --------------------
// CADASTRO DE PEDIDO
// --------------------
app.post("/pedidos", requireAuth, async (req, res) => {
  const {
    clienteNome,
    telefone,
    endereco,
    observacao,
    formaPagamento,
    trocoParaCentavos,
    itens,
  } = req.body || {};

  const db = getDB();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const fp = String(formaPagamento || "").toUpperCase();
    const troco = Number(trocoParaCentavos || 0) || 0;

    const resPedido = await client.query(
      `
      INSERT INTO pedidos (clientenome, telefone, endereco, observacao, formapagamento, trocoParaCentavos, status, createdat)
      VALUES ($1, $2, $3, $4, $5, $6, 'ABERTO', NOW())
      RETURNING *
      `,
      [
        clienteNome || "",
        telefone || "",
        endereco || "",
        observacao || "",
        fp,
        troco,
      ],
    );

    const pedido = resPedido.rows[0];

    for (const it of itens || []) {
      const produtoId = Number(it.produtoId);
      const qtd = Number(it.qtd || 0);

      const resProd = await client.query(
        `SELECT id, nome, precocentavos FROM produtos WHERE id = $1`,
        [produtoId],
      );
      const prod = resProd.rows[0];
      if (!prod) throw new Error(`Produto não encontrado: ${produtoId}`);

      const preco = Number(prod.precocentavos || 0);
      const subtotal = qtd * preco;

      await client.query(
        `
           INSERT INTO pedido_itens (
           pedidoid,
           produtoid,
           "produtoNome",
           qtd,
           precocentavos,
          "subtotalCentavos"
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [pedido.id, produtoId, prod.nome, qtd, preco, subtotal],
      );
    }

    await client.query("COMMIT");

    notifyEntregadores(pedido).catch((e) =>
      console.error("Erro push:", e.message),
    );
    res.status(201).json(pedido);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
// --------------------
// BACKUP
// --------------------
app.get(
  "/admin/backup/export",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const db = getDB();

      const [users, produtos, clientes, pedidos, pedidoItens] =
        await Promise.all([
          db.query(`SELECT id, username, role FROM public.users ORDER BY id`),
          db.query(`SELECT * FROM produtos ORDER BY id`),
          db.query(`SELECT * FROM clientes ORDER BY id`),
          db.query(`SELECT * FROM pedidos ORDER BY id`),
          db.query(`SELECT * FROM pedido_itens ORDER BY id`),
        ]);

      const backup = {
        exportadoEm: new Date().toISOString(),
        users: users.rows,
        produtos: produtos.rows,
        clientes: clientes.rows,
        pedidos: pedidos.rows,
        pedidoItens: pedidoItens.rows,
      };

      const json = JSON.stringify(backup, null, 2);
      const filename = `backup-${new Date().toISOString().slice(0, 10)}.json`;

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.send(json);
    } catch (err) {
      console.error("Erro ao exportar backup:", err.message);
      res.status(500).json({ error: err.message });
    }
  },
);
// --------------------
// START
// --------------------
app.listen(PORT, HOST, () => {
  console.log(`🚀 ETGÁGUA Backend rodando em http://${HOST}:${PORT}`);
});
