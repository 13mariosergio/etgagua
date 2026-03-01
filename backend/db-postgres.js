const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  port: process.env.PGPORT || 5432,
  // Forçar SSL para garantir conexão com o Supabase
  ssl: { rejectUnauthorized: false } 
});

async function initDB() {
  const client = await pool.connect();

  try {
    console.log("🔄 Iniciando banco PostgreSQL...");

    // =========================
    // Tabela de usuários
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
    // Tabela de assinaturas de push
    // =========================
    await client.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✅ Tabela push_subscriptions criada/verificada");

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

    // MIGRAÇÃO: garantir ponto_referencia
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

    // MIGRAÇÃO: garantir ativo
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
        trocoParaCentavos INTEGER DEFAULT 0,
        createdAt TIMESTAMP DEFAULT NOW(),
        entregadorId INTEGER REFERENCES users(id)
      )
    `);
    console.log("✅ Tabela pedidos criada/verificada");

    // MIGRAÇÃO: garantir coluna trocoParaCentavos
    await client.query(`
      ALTER TABLE pedidos
      ADD COLUMN IF NOT EXISTS trocoParaCentavos INTEGER DEFAULT 0
    `);
    await client.query(`
      UPDATE pedidos
      SET trocoParaCentavos = 0
      WHERE trocoParaCentavos IS NULL
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
