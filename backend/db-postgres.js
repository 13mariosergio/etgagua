const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false
});

async function initDB() {
  const client = await pool.connect();

  try {
    /* =========================
       TABELA DE USUÁRIOS
    ========================== */
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        role TEXT NOT NULL
          CHECK (role IN ('ADMIN', 'ATENDENTE', 'ENTREGADOR'))
      )
    `);

    /* =========================
       TABELA DE PRODUTOS
    ========================== */
    await client.query(`
      CREATE TABLE IF NOT EXISTS produtos (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        precoCentavos INTEGER NOT NULL
      )
    `);

    /* =========================
       COLUNA ATIVO (BOOLEAN)
    ========================== */
    try {
      await client.query(`
        ALTER TABLE produtos
        ADD COLUMN ativo BOOLEAN DEFAULT true
      `);
      console.log('✅ Coluna ativo adicionada à tabela produtos');
    } catch (err) {
      if (err.code === '42701') {
        console.log('ℹ️ Coluna ativo já existe');
      } else {
        throw err;
      }
    }

    // Garantir produtos antigos como ativos
    await client.query(`
      UPDATE produtos
      SET ativo = true
      WHERE ativo IS NULL
    `);

    /* =========================
       TABELA DE PEDIDOS
    ========================== */
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

    /* =========================
       ITENS DO PEDIDO
    ========================== */
    await client.query(`
      CREATE TABLE IF NOT EXISTS pedido_itens (
        id SERIAL PRIMARY KEY,
        pedidoId INTEGER NOT NULL
          REFERENCES pedidos(id) ON DELETE CASCADE,
        produtoId INTEGER NOT NULL
          REFERENCES produtos(id),
        qtd INTEGER NOT NULL,
        precoCentavos INTEGER NOT NULL
      )
    `);

    /* =========================
       USUÁRIO ADMIN PADRÃO
    ========================== */
    const checkAdmin = await client.query(
      `SELECT 1 FROM users WHERE username = 'admin'`
    );

    if (checkAdmin.rows.length === 0) {
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('admin123', 10);

      await client.query(
        `INSERT INTO users (username, passwordHash, role)
         VALUES ($1, $2, $3)`,
        ['admin', hash, 'ADMIN']
      );

      console.log('✅ Usuário admin criado');
    }

    /* =========================
       PRODUTOS PADRÃO
    ========================== */
    const checkProdutos = await client.query(
      `SELECT COUNT(*) AS count FROM produtos`
    );

    if (parseInt(checkProdutos.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO produtos (nome, precoCentavos, ativo) VALUES
        ('Vasilhame 20L + água', 2300, true),
        ('Vasilhame 20L (vazio)', 3500, true),
        ('Água 20L (troca)', 1050, true)
      `);

      console.log('✅ Produtos padrão criados');
    }

    console.log('🚀 Banco PostgreSQL inicializado com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao inicializar banco:', err);
    throw err;
  } finally {
    client.release();
  }
}

/* =========================
   EXPORTS
========================== */
function getDB() {
  return pool;
}

module.exports = {
  initDB,
  getDB
};
