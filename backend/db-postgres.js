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
    // =========================
    // USERS
    // =========================
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('ADMIN', 'ATENDENTE', 'ENTREGADOR'))
      )
    `);

    // =========================
    // PRODUTOS (cria com padrão minúsculo no banco)
    // =========================
    await client.query(`
      CREATE TABLE IF NOT EXISTS produtos (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        precocentavos INTEGER NOT NULL
      )
    `);

    // =========================
    // MIGRAÇÃO: se existir "precoCentavos" (camelCase com aspas), renomear
    // =========================
    const colCamel = await client.query(`
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'produtos'
        AND column_name = 'precoCentavos'
      LIMIT 1
    `);

    const colLower = await client.query(`
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'produtos'
        AND column_name = 'precocentavos'
      LIMIT 1
    `);

    if (colCamel.rows.length > 0 && colLower.rows.length === 0) {
      await client.query(`ALTER TABLE produtos RENAME COLUMN "precoCentavos" TO precocentavos`);
      console.log('✅ Migração: "precoCentavos" -> precocentavos');
    }

    // =========================
    // ATIVO: garantir coluna e converter INTEGER -> BOOLEAN se necessário
    // =========================
    await client.query(`
      ALTER TABLE produtos
      ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true
    `);

    const ativoCol = await client.query(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name = 'produtos'
        AND column_name = 'ativo'
      LIMIT 1
    `);

    if (ativoCol.rows.length > 0 && ativoCol.rows[0].data_type === "integer") {
      await client.query(`
        ALTER TABLE produtos
        ALTER COLUMN ativo TYPE BOOLEAN
        USING (ativo = 1)
      `);
      console.log("✅ Migração: ativo INTEGER -> BOOLEAN");
    }

    await client.query(`ALTER TABLE produtos ALTER COLUMN ativo SET DEFAULT true`);
    await client.query(`UPDATE produtos SET ativo = true WHERE ativo IS NULL`);

    // =========================
    // PEDIDOS
    // =========================
    await client.query(`
      CREATE TABLE IF NOT EXISTS pedidos (
        id SERIAL PRIMARY KEY,
        clientenome TEXT NOT NULL,
        telefone TEXT,
        endereco TEXT NOT NULL,
        observacao TEXT,
        status TEXT NOT NULL DEFAULT 'ABERTO'
          CHECK (status IN ('ABERTO', 'EM_ROTA', 'ENTREGUE', 'CANCELADO')),
        formapagamento TEXT NOT NULL
          CHECK (formapagamento IN ('DINHEIRO', 'PIX', 'CARTAO')),
        trocoparacentavos INTEGER,
        createdat TIMESTAMP DEFAULT NOW(),
        entregadorid INTEGER REFERENCES users(id)
      )
    `);

    // =========================
    // ITENS
    // =========================
    await client.query(`
      CREATE TABLE IF NOT EXISTS pedido_itens (
        id SERIAL PRIMARY KEY,
        pedidoid INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
        produtoid INTEGER NOT NULL REFERENCES produtos(id),
        qtd INTEGER NOT NULL,
        precocentavos INTEGER NOT NULL
      )
    `);

    // =========================
    // ADMIN PADRÃO
    // =========================
    const checkAdmin = await client.query(`SELECT 1 FROM users WHERE username = 'admin'`);
    if (checkAdmin.rows.length === 0) {
      const bcrypt = require("bcrypt");
      const hash = await bcrypt.hash("admin123", 10);
      await client.query(
        `INSERT INTO users (username, passwordHash, role) VALUES ($1, $2, $3)`,
        ["admin", hash, "ADMIN"]
      );
      console.log("✅ Usuário admin criado");
    }

    // =========================
    // PRODUTOS PADRÃO
    // =========================
    const checkProdutos = await client.query(`SELECT COUNT(*) AS count FROM produtos`);

    if (parseInt(checkProdutos.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO produtos (nome, precocentavos, ativo) VALUES
        ('Vasilhame 20L + água', 2300, true),
        ('Vasilhame 20L (vazio)', 3500, true),
        ('Água 20L (troca)', 1050, true)
      `);
      console.log("✅ Produtos padrão criados");
    }

    console.log("✅ Banco PostgreSQL inicializado com sucesso!");
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
