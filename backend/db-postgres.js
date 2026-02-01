const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

async function initDB() {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('ADMIN', 'ATENDENTE', 'ENTREGADOR'))
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS produtos (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        precoCentavos INTEGER NOT NULL
      )
    `);

    // ✅ garante coluna ativo
    await client.query(`
      ALTER TABLE produtos
      ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true
    `);

    // ✅ garante que os antigos ficam ativos
    await client.query(`
      UPDATE produtos SET ativo = true WHERE ativo IS NULL
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pedidos (
        id SERIAL PRIMARY KEY,
        clienteNome TEXT NOT NULL,
        telefone TEXT,
        endereco TEXT NOT NULL,
        observacao TEXT,
        status TEXT NOT NULL DEFAULT 'ABERTO'
          CHECK (status IN ('ABERTO', 'EM_ROTA', 'ENTREGUE', 'CANCELADO')),
        formaPagamento TEXT NOT NULL
          CHECK (formaPagamento IN ('DINHEIRO', 'PIX', 'CARTAO')),
        trocoParaCentavos INTEGER,
        createdAt TIMESTAMP DEFAULT NOW(),
        entregadorId INTEGER REFERENCES users(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pedido_itens (
        id SERIAL PRIMARY KEY,
        pedidoId INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
        produtoId INTEGER NOT NULL REFERENCES produtos(id),
        qtd INTEGER NOT NULL,
        precoCentavos INTEGER NOT NULL
      )
    `);

    // admin padrão
    const checkAdmin = await client.query(`SELECT 1 FROM users WHERE username = 'admin'`);
    if (checkAdmin.rows.length === 0) {
      const bcrypt = require("bcrypt");
      const hash = await bcrypt.hash("admin123", 10);
      await client.query(
        `INSERT INTO users (username, passwordHash, role) VALUES ($1, $2, $3)`,
        ["admin", hash, "ADMIN"]
      );
    }

    // produtos padrão
    const checkProdutos = await client.query(`SELECT COUNT(*) AS count FROM produtos`);
    if (parseInt(checkProdutos.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO produtos (nome, precoCentavos, ativo) VALUES
        ('Vasilhame 20L + água', 2300, true),
        ('Vasilhame 20L (vazio)', 3500, true),
        ('Água 20L (troca)', 1050, true)
      `);
    }

    console.log("✅ Banco PostgreSQL inicializado com sucesso!");
  } finally {
    client.release();
  }
}

function getDB() {
  return pool;
}

module.exports = { initDB, getDB };
