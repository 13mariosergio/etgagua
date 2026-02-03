const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDB() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Iniciando banco PostgreSQL...');

    // =========================
    // Tabela de usuários
    // =========================
// NOVA TABELA DE CLIENTES
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
console.log('✅ Tabela clientes criada');

    // 🆕 MIGRAÇÃO: Adicionar coluna ponto_referencia se não existir
try {
  await client.query(`
    ALTER TABLE clientes 
    ADD COLUMN IF NOT EXISTS "ponto_referencia" TEXT
  `);
  console.log('✅ Coluna ponto_referencia verificada/adicionada');
} catch (err) {
  console.log('ℹ️ Coluna ponto_referencia:', err.message);
}

    // =========================
    // Tabela de produtos COM COLUNA ATIVO
    // =========================
    await client.query(`
      CREATE TABLE IF NOT EXISTS produtos (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        precoCentavos INTEGER NOT NULL,
        ativo BOOLEAN DEFAULT true
      )
    `);
    console.log('✅ Tabela produtos criada/verificada');

    // MIGRAÇÃO: Adicionar coluna ativo se não existir (para bancos antigos)
    try {
      await client.query(`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true`);
      await client.query(`UPDATE produtos SET ativo = true WHERE ativo IS NULL`);
      console.log('✅ Coluna ativo verificada/adicionada');
    } catch (err) {
      if (err.code !== '42701') {
        console.log('ℹ️ Erro ao adicionar coluna ativo:', err.message);
      }
    }

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
        trocoParaCentavos INTEGER,
        createdAt TIMESTAMP DEFAULT NOW(),
        entregadorId INTEGER REFERENCES users(id)
      )
    `);
    console.log('✅ Tabela pedidos criada/verificada');

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
    console.log('✅ Tabela pedido_itens criada/verificada');

    // =========================
    // Criar usuário admin padrão
    // =========================
    const checkAdmin = await client.query(`SELECT 1 FROM users WHERE username = 'admin'`);
    
    if (checkAdmin.rows.length === 0) {
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('admin123', 10);
      await client.query(
        `INSERT INTO users (username, passwordHash, role) VALUES ($1, $2, $3)`,
        ['admin', hash, 'ADMIN']
      );
      console.log('✅ Usuário admin criado (admin/admin123)');
    }

    // =========================
    // Criar produtos padrão
    // =========================
    const checkProdutos = await client.query(`SELECT COUNT(*) as count FROM produtos`);
    
    if (parseInt(checkProdutos.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO produtos (nome, precoCentavos, ativo) VALUES
        ('Vasilhame 20L + água', 2300, true),
        ('Vasilhame 20L (vazio)', 3500, true),
        ('Água 20L (troca)', 1050, true)
      `);
      console.log('✅ Produtos padrão criados');
    }

    console.log('🎉 Banco PostgreSQL inicializado com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao inicializar banco:', err);
    throw err;
  } finally {
    client.release();
  }
}

function getDB() {
  return pool;
}

module.exports = { initDB, getDB };