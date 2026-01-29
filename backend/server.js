require("dotenv").config();

const express = require("express");
const cors = require("cors");
const db = require("./db");
const bcrypt = require("bcrypt");
const { signToken, requireAuth, requireRole } = require("./auth");

const relatoriosRoutes = require("./relatorios"); // ✅ aqui em cima

const app = express();

// Configurações via variáveis de ambiente
const PORT = process.env.PORT || 3333;
const HOST = process.env.HOST || "0.0.0.0"; // 0.0.0.0 permite acesso de qualquer IP na rede

app.use(cors());
app.use(express.json());

// =======================
// Health check (raiz e /health)
// =======================
app.get("/", (req, res) => {
  res.json({ ok: true, name: "ETGÁGUA Backend", time: new Date().toISOString() });
});

app.get("/health", (req, res) => {
  res.json({ ok: true, name: "ETGÁGUA Backend", time: new Date().toISOString() });
});

// =======================
// Relatórios (ADMIN) - protegido por token
// relatorios.js já valida ADMIN
// =======================
app.use("/relatorios", requireAuth, relatoriosRoutes);

// =======================
// Produtos ativos (para montar pedidos)
// =======================
app.get("/produtos", requireAuth, (req, res) => {
  db.all(
    "SELECT id, nome, volumeMl, tipo, precoCentavos FROM produtos WHERE ativo = 1 ORDER BY id DESC",
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// =======================
// Login
// =======================
app.post("/auth/login", (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: "username e password são obrigatórios" });
  }

  db.get(
    "SELECT id, username, passwordHash, role, ativo FROM users WHERE username = ?",
    [username],
    async (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(401).json({ error: "Usuário ou senha inválidos" });
      if (user.ativo !== 1) return res.status(403).json({ error: "Usuário inativo" });

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: "Usuário ou senha inválidos" });

      const token = signToken(user);
      res.json({
        token,
        user: { id: user.id, username: user.username, role: user.role },
      });
    }
  );
});

// =======================
// Admin - Users
// =======================
app.get("/admin/users", requireAuth, requireRole("ADMIN"), (req, res) => {
  db.all(
    "SELECT id, username, role, ativo, criadoEm FROM users ORDER BY id DESC",
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post("/admin/users", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { username, password, role } = req.body || {};

  if (!username || !password || !role) {
    return res.status(400).json({ error: "username, password e role são obrigatórios" });
  }

  if (!["ADMIN", "ATENDENTE", "ENTREGADOR"].includes(role)) {
    return res.status(400).json({ error: "role inválido" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  db.run(
    "INSERT INTO users (username, passwordHash, role) VALUES (?, ?, ?)",
    [username, passwordHash, role],
    function (err) {
      if (err) {
        if (String(err.message || "").includes("UNIQUE")) {
          return res.status(409).json({ error: "username já existe" });
        }
        return res.status(500).json({ error: err.message });
      }

      db.get(
        "SELECT id, username, role, ativo, criadoEm FROM users WHERE id = ?",
        [this.lastID],
        (err2, row) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.status(201).json(row);
        }
      );
    }
  );
});

// =======================
// Admin - Produtos
// =======================
app.get("/admin/produtos", requireAuth, requireRole("ADMIN"), (req, res) => {
  db.all("SELECT * FROM produtos ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/admin/produtos", requireAuth, requireRole("ADMIN"), (req, res) => {
  const { nome, volumeMl, tipo, precoCentavos, ativo } = req.body || {};

  if (!nome) return res.status(400).json({ error: "nome é obrigatório" });

  const tipoFinal = tipo || "AGUA";
  let precoFinal = Number(precoCentavos);
  if (!Number.isFinite(precoFinal)) precoFinal = 0;
  if (!Number.isInteger(precoFinal)) precoFinal = Math.round(precoFinal);
  if (precoFinal < 0) return res.status(400).json({ error: "precoCentavos não pode ser negativo" });

  const volFinal = volumeMl === null || volumeMl === undefined || volumeMl === "" ? null : Number(volumeMl);
  const ativoFinal = ativo === 0 ? 0 : 1;

  db.run(
    "INSERT INTO produtos (nome, volumeMl, tipo, precoCentavos, ativo) VALUES (?, ?, ?, ?, ?)",
    [nome, volFinal, tipoFinal, precoFinal, ativoFinal],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      db.get("SELECT * FROM produtos WHERE id = ?", [this.lastID], (err2, row) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.status(201).json(row);
      });
    }
  );
});

app.patch("/admin/produtos/:id", requireAuth, requireRole("ADMIN"), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "id inválido" });

  const { nome, volumeMl, tipo, precoCentavos, ativo } = req.body || {};

  db.get("SELECT * FROM produtos WHERE id = ?", [id], (err, atual) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!atual) return res.status(404).json({ error: "Produto não encontrado" });

    const nomeFinal = nome ?? atual.nome;
    const tipoFinal = tipo ?? atual.tipo;

    const volFinal =
      volumeMl === undefined ? atual.volumeMl : (volumeMl === null || volumeMl === "" ? null : Number(volumeMl));

    let precoFinal =
      precoCentavos === undefined ? atual.precoCentavos : Number(precoCentavos);
    if (!Number.isFinite(precoFinal)) precoFinal = atual.precoCentavos;
    if (!Number.isInteger(precoFinal)) precoFinal = Math.round(precoFinal);
    if (precoFinal < 0) return res.status(400).json({ error: "precoCentavos não pode ser negativo" });

    const ativoFinal = ativo === undefined ? atual.ativo : (ativo ? 1 : 0);

    db.run(
      "UPDATE produtos SET nome = ?, volumeMl = ?, tipo = ?, precoCentavos = ?, ativo = ? WHERE id = ?",
      [nomeFinal, volFinal, tipoFinal, precoFinal, ativoFinal, id],
      function (err2) {
        if (err2) return res.status(500).json({ error: err2.message });

        db.get("SELECT * FROM produtos WHERE id = ?", [id], (err3, row) => {
          if (err3) return res.status(500).json({ error: err3.message });
          res.json(row);
        });
      }
    );
  });
});

// =======================
// Seed: admin e produtos padrão (1º uso)
// =======================
(async () => {
  db.get("SELECT COUNT(*) as total FROM users", [], async (err, row) => {
    if (err) return console.error("Erro ao contar users:", err.message);

    if (row.total === 0) {
      const username = "admin";
      const password = "admin123";
      const passwordHash = await bcrypt.hash(password, 10);

      db.run(
        "INSERT INTO users (username, passwordHash, role) VALUES (?, ?, ?)",
        [username, passwordHash, "ADMIN"],
        (err2) => {
          if (err2) return console.error("Erro ao criar admin padrão:", err2.message);
          console.log("✅ Admin padrão criado: user=admin senha=admin123 (trocar depois)");
        }
      );
    }
  });

  db.get("SELECT COUNT(*) as total FROM produtos", [], (err, row) => {
    if (err) return console.error("Erro ao contar produtos:", err.message);

    if (row.total === 0) {
      const padrao = [
        { nome: "Galão 20L (água)", volumeMl: 20000, tipo: "AGUA", precoCentavos: 0 },
        { nome: "Vasilhame 20L (vazio)", volumeMl: 20000, tipo: "VASILHAME", precoCentavos: 0 },
        { nome: "Vasilhame 20L + água", volumeMl: 20000, tipo: "COMBO", precoCentavos: 0 },
        { nome: "Água 1,5L", volumeMl: 1500, tipo: "AGUA", precoCentavos: 0 },
        { nome: "Água 500ml", volumeMl: 500, tipo: "AGUA", precoCentavos: 0 },
        { nome: "Água 5L", volumeMl: 5000, tipo: "AGUA", precoCentavos: 0 },
      ];

      padrao.forEach((p) => {
        db.run(
          "INSERT INTO produtos (nome, volumeMl, tipo, precoCentavos) VALUES (?, ?, ?, ?)",
          [p.nome, p.volumeMl, p.tipo, p.precoCentavos]
        );
      });

      console.log("✅ Produtos padrão criados (com preço 0; ajustar no Admin).");
    }
  });
})();

// =======================
// Pedidos (listar com itens)
// =======================
app.get("/pedidos", requireAuth, (req, res) => {
  const { status } = req.query;

  const sql = status
    ? "SELECT * FROM pedidos WHERE status = ? ORDER BY id DESC"
    : "SELECT * FROM pedidos ORDER BY id DESC";

  const params = status ? [status] : [];

  db.all(sql, params, (err, pedidos) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!pedidos || pedidos.length === 0) return res.json([]);

    const ids = pedidos.map((p) => p.id);
    const placeholders = ids.map(() => "?").join(",");

    db.all(
      `SELECT * FROM pedido_itens WHERE pedidoId IN (${placeholders}) ORDER BY id ASC`,
      ids,
      (err2, itens) => {
        if (err2) return res.status(500).json({ error: err2.message });

        const map = new Map();
        for (const it of itens) {
          if (!map.has(it.pedidoId)) map.set(it.pedidoId, []);
          map.get(it.pedidoId).push(it);
        }

        const out = pedidos.map((p) => ({ ...p, itens: map.get(p.id) || [] }));
        res.json(out);
      }
    );
  });
});

// =======================
// Criar pedido com itens + troco
// =======================
// Criar pedido com itens + troco + formaPagamento
app.post("/pedidos", requireAuth, (req, res) => {
  const { clienteNome, telefone, endereco, observacao, itens, trocoParaCentavos, formaPagamento } = req.body || {};

  if (!clienteNome || !endereco) {
    return res.status(400).json({ error: "clienteNome e endereco são obrigatórios" });
  }

  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: "itens é obrigatório (array com pelo menos 1 item)" });
  }

  const forma = (formaPagamento || "DINHEIRO").toUpperCase();
  const allowedPag = ["DINHEIRO", "PIX", "CARTAO"];
  if (!allowedPag.includes(forma)) {
    return res.status(400).json({ error: "formaPagamento inválida", allowed: allowedPag });
  }

  const parsedItens = itens
    .map((i) => ({
      produtoId: Number(i.produtoId),
      qtd: Number(i.qtd),
    }))
    .filter(
      (i) => Number.isInteger(i.produtoId) && i.produtoId > 0 && Number.isInteger(i.qtd) && i.qtd > 0
    );

  if (parsedItens.length !== itens.length) {
    return res.status(400).json({ error: "itens inválidos. Use {produtoId, qtd} com números > 0" });
  }

  const ids = parsedItens.map((i) => i.produtoId);
  const placeholders = ids.map(() => "?").join(",");

  db.all(
    `SELECT id, nome, precoCentavos, ativo FROM produtos WHERE id IN (${placeholders}) AND ativo = 1`,
    ids,
    (err, produtos) => {
      if (err) return res.status(500).json({ error: err.message });

      if (!produtos || produtos.length !== ids.length) {
        return res.status(400).json({ error: "Um ou mais produtos não existem ou estão inativos" });
      }

      const mapProd = new Map(produtos.map((p) => [p.id, p]));

      const itensSnap = parsedItens.map((it) => {
        const p = mapProd.get(it.produtoId);
        const precoUnitCentavos = Number(p.precoCentavos || 0);
        const subtotalCentavos = precoUnitCentavos * it.qtd;

        return {
          produtoId: p.id,
          produtoNome: p.nome,
          qtd: it.qtd,
          precoUnitCentavos,
          subtotalCentavos,
        };
      });

      const totalCentavos = itensSnap.reduce((acc, i) => acc + i.subtotalCentavos, 0);

      // Troco só faz sentido no dinheiro
      let trocoPara =
        trocoParaCentavos === null || trocoParaCentavos === undefined || trocoParaCentavos === ""
          ? null
          : Number(trocoParaCentavos);

      if (forma !== "DINHEIRO") trocoPara = null;

      if (trocoPara !== null && (!Number.isFinite(trocoPara) || trocoPara < totalCentavos)) {
        return res.status(400).json({ error: "trocoParaCentavos deve ser >= totalCentavos" });
      }

      const trocoCentavos = trocoPara === null ? 0 : trocoPara - totalCentavos;

      db.run(
        `INSERT INTO pedidos (clienteNome, telefone, endereco, observacao, status, totalCentavos, trocoParaCentavos, trocoCentavos, formaPagamento)
         VALUES (?, ?, ?, ?, 'ABERTO', ?, ?, ?, ?)`,
        [clienteNome, telefone || "", endereco, observacao || "", totalCentavos, trocoPara, trocoCentavos, forma],
        function (err2) {
          if (err2) return res.status(500).json({ error: err2.message });

          const pedidoId = this.lastID;

          const stmt = db.prepare(
            `INSERT INTO pedido_itens (pedidoId, produtoId, produtoNome, qtd, precoUnitCentavos, subtotalCentavos)
             VALUES (?, ?, ?, ?, ?, ?)`
          );

          for (const item of itensSnap) {
            stmt.run([
              pedidoId,
              item.produtoId,
              item.produtoNome,
              item.qtd,
              item.precoUnitCentavos,
              item.subtotalCentavos,
            ]);
          }

          stmt.finalize((err3) => {
            if (err3) return res.status(500).json({ error: err3.message });

            db.get("SELECT * FROM pedidos WHERE id = ?", [pedidoId], (err4, pedido) => {
              if (err4) return res.status(500).json({ error: err4.message });

              db.all(
                "SELECT * FROM pedido_itens WHERE pedidoId = ? ORDER BY id ASC",
                [pedidoId],
                (err5, rows) => {
                  if (err5) return res.status(500).json({ error: err5.message });
                  res.status(201).json({ ...pedido, itens: rows || [] });
                }
              );
            });
          });
        }
      );
    }
  );
});


// =======================
// Atualizar status do pedido (protegido)
// =======================
app.patch("/pedidos/:id/status", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  const allowed = ["ABERTO", "EM_ROTA", "ENTREGUE", "CANCELADO"];

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "id inválido" });
  }

  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ error: "status inválido", allowed });
  }

  db.run("UPDATE pedidos SET status = ? WHERE id = ?", [status, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Pedido não encontrado" });

    db.get("SELECT * FROM pedidos WHERE id = ?", [id], (err2, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row);
    });
  });
});

app.listen(PORT, HOST, () => {
  console.log(`🚀 ETGÁGUA Backend rodando em http://${HOST}:${PORT}`);
  console.log(`📡 Acesse de outros dispositivos usando o IP da máquina na porta ${PORT}`);
});
