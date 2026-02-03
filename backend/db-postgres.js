const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

async function initDB() {
  const client = await pool.connect();

  try {
    console.log("🔄 Iniciando banco PostgreSQL...");

    // =========================
    // Tabela de usuários (PRECISA existir, pq pedidos referencia users)
    // =========================
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('ADMIN', 'ATENDENTE', 'ENTREGADOR'))
      )
    `);
    console.log("✅ Tabela users criada/verificada");

    // =========================
    // Tabela de clientes
    // =========================
    await client.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id SERIAL PRIMARY KEY,
        codigo TEXT UNIQUE NOT NULL,
        nome TEXT NOT NULL,
        endereco TEXT NOT NULL,
        ponto_referencia TEXT,
        telefone TEXT,
        cpf TEXT,
        ativo BOOLEAN DEFAULT true,
        createdAt TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✅ Tabela clientes criada/verificada");

    // MIGRAÇÃO: garantir ponto_referencia (se banco antigo)
    await client.query(`
      ALTER TABLE clientes
      ADD COLUMN IF NOT EXISTS ponto_referencia TEXT
    `);

    // =========================
    // Tabela de produtos
    // =========================
    await client.query(`
      CREATE TABLE IF NOT EXISTS produtos (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        precoCentavos INTEGER NOT NULL,
        ativo BOOLEAN DEFAULT true
      )
    `);
    console.log("✅ Tabela produtos criada/verificada");

    // MIGRAÇÃO: garantir ativo (se banco antigo)
    await client.query(`
      ALTER TABLE produtos
      ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true
    `);
    await client.query(`
      UPDATE produtos SET ativo = true WHERE ativo IS NULL
    `);

    // =========================
    // Tabela de pedidos
    // =========================
    await client.query(`
      CREATE TABLE IF NOT EXISTS pedidos (
        id SERIAL PRIMARY KEY,
        clienteNome TEXT NOT NULL,
        telefone TEXT,
        endereco TEXT NOT NULL,
        observacao TEXT,
        status TEXT NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'EM_ROTA', 'ENTREGUE', 'CANCELADO')),
        formaPagamento TEXT NOT NULL CHECK (formaPagamento IN ('DINHEIRO', 'PIX', 'CARTAO')),
        troco_para_centavos INTEGER DEFAULT 0,
        createdAt TIMESTAMP DEFAULT NOW(),
        entregadorId INTEGER REFERENCES users(id)
      )
    `);
    console.log("✅ Tabela pedidos criada/verificada");

    // ✅ MIGRAÇÃO: garantir coluna troco_para_centavos (se banco antigo)
    await client.query(`
      ALTER TABLE pedidos
      ADD COLUMN IF NOT EXISTS troco_para_centavos INTEGER DEFAULT 0
    `);
    await client.query(`
      UPDATE pedidos
      SET troco_para_centavos = 0
      WHERE troco_para_centavos IS NULL
    `);

    // =========================
    // Tabela de itens do pedido
    // =========================
    await client.query(`
      CREATE TABLE IF NOT EXISTS pedido_itens (
        id SERIAL PRIMARY KEY,
        pedidoId INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
        produtoId INTEGER NOT NULL REFERENCES produtos(id),
        qtd INTEGER NOT NULL,
        precoCentavos INTEGER NOT NULL
      )
    `);
    console.log("✅ Tabela pedido_itens criada/verificada");

    // =========================
    // Criar usuário admin padrão
    // =========================
    const checkAdmin = await client.query(`SELECT 1 FROM users WHERE username = 'admin'`);
    if (checkAdmin.rows.length === 0) {
      const bcrypt = require("bcrypt");
      const hash = await bcrypt.hash("admin123", 10);

      await client.query(
        `INSERT INTO users (username, passwordHash, role) VALUES ($1, $2, $3)`,
        ["admin", hash, "ADMIN"]
      );

      console.log("✅ Usuário admin criado (admin/admin123)");
    }

    // =========================
    // Criar produtos padrão
    // =========================
    const checkProdutos = await client.query(`SELECT COUNT(*) as count FROM produtos`);
    if (parseInt(checkProdutos.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO produtos (nome, precoCentavos, ativo) VALUES
        ('Vasilhame 20L + água', 2300, true),
        ('Vasilhame 20L (vazio)', 3500, true),
        ('Água 20L (troca)', 1050, true)
      `);
      console.log("✅ Produtos padrão criados");
    }

    console.log("🎉 Banco PostgreSQL inicializado com sucesso!");
  } catch (err) {
    console.error("❌ Erro ao inicializar banco:", err);
    throw err;
  } finally {
    client.release();
  }
}

function getDB() {
  return pool;
}

module.exports = { initDB, getDB };
