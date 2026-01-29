const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const DB_PATH = path.join(__dirname, "etgagua.sqlite");

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("Erro ao abrir o SQLite:", err.message);
    process.exit(1);
  }
  console.log("SQLite conectado em:", DB_PATH);
});

db.serialize(() => {
  // Tabela de pedidos
  db.run(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clienteNome TEXT NOT NULL,
      telefone TEXT,
      endereco TEXT NOT NULL,
      observacao TEXT,
      status TEXT NOT NULL DEFAULT 'ABERTO',
      criadoEm TEXT NOT NULL DEFAULT (datetime('now'))
      
    )
  `);

  // ===== MIGRAÇÕES (para não quebrar quando adicionarmos campos novos) =====
  // Adiciona formaPagamento em pedidos (se não existir)
  db.all("PRAGMA table_info(pedidos)", [], (err, cols) => {
    if (err) {
      console.error("Erro PRAGMA table_info(pedidos):", err.message);
      return;
    }
    const existe = (cols || []).some((c) => c.name === "formaPagamento");
    if (!existe) {
      db.run(
        "ALTER TABLE pedidos ADD COLUMN formaPagamento TEXT NOT NULL DEFAULT 'DINHEIRO'",
        (e2) => {
          if (e2) console.error("Erro ao adicionar formaPagamento:", e2.message);
          else console.log("✅ Migração: coluna pedidos.formaPagamento criada (default DINHEIRO)");
        }
      );
    }
  });


  // Tabela de usuários
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('ADMIN','ATENDENTE','ENTREGADOR')),
      ativo INTEGER NOT NULL DEFAULT 1,
      criadoEm TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Tabela de produtos (água e variações)
  db.run(`
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      volumeMl INTEGER,
      tipo TEXT NOT NULL DEFAULT 'AGUA',
      precoCentavos INTEGER NOT NULL DEFAULT 0,
      ativo INTEGER NOT NULL DEFAULT 1,
      criadoEm TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Itens do pedido (snapshot de preço)
  db.run(`
    CREATE TABLE IF NOT EXISTS pedido_itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedidoId INTEGER NOT NULL,
      produtoId INTEGER NOT NULL,
      produtoNome TEXT NOT NULL,
      qtd INTEGER NOT NULL,
      precoUnitCentavos INTEGER NOT NULL,
      subtotalCentavos INTEGER NOT NULL,
      criadoEm TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (pedidoId) REFERENCES pedidos(id)
    )
  `);

  // Adiciona colunas em pedidos (se não existirem)
  db.run(`ALTER TABLE pedidos ADD COLUMN totalCentavos INTEGER NOT NULL DEFAULT 0`, () => {});
  db.run(`ALTER TABLE pedidos ADD COLUMN trocoParaCentavos INTEGER`, () => {});
  db.run(`ALTER TABLE pedidos ADD COLUMN trocoCentavos INTEGER NOT NULL DEFAULT 0`, () => {});


});

module.exports = db;
