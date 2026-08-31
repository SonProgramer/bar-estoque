const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

// Configuração do Banco de Dados SQLite
const db = new sqlite3.Database('./database/estoque.db', (err) => {
  if (err) console.error('Erro ao conectar ao SQLite:', err.message);
  else console.log('Conectado ao banco de dados SQLite.');
});

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'bar-estoque-chave-secreta-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));

// Inicialização das Tabelas
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('ADMINISTRADOR', 'FUNCIONÁRIO'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    brand TEXT,
    barcode TEXT UNIQUE,
    quantity INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    unit TEXT DEFAULT 'UN',
    cost_price REAL DEFAULT 0,
    sell_price REAL DEFAULT 0,
    location TEXT,
    notes TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('ENTRADA', 'SAÍDA', 'PERDA', 'AJUSTE')),
    quantity INTEGER NOT NULL,
    prev_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    user_name TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY(product_id) REFERENCES products(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS conferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    registered_stock INTEGER NOT NULL,
    found_stock INTEGER NOT NULL,
    difference INTEGER NOT NULL,
    user_name TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id)
  )`);

  // Usuário Administrador Inicial
  db.get(`SELECT * FROM users WHERE username = 'admin'`, [], (err, row) => {
    if (!row) {
      const hash = bcrypt.hashSync('admin123', 10);
      db.run(`INSERT INTO users (name, username, password, role) VALUES ('Admin Inicial', 'admin', ?, 'ADMINISTRADOR')`, [hash]);
    }
  });

  // Produtos Iniciais
  db.get(`SELECT COUNT(*) as count FROM products`, [], (err, row) => {
    if (row && row.count === 0) {
      const initProducts = [
        ['Coca-Cola Lata', 'Refrigerantes', 'Coca-Cola', '7894900011517', 48, 12, 'UN', 2.50, 6.00, 'Geladeira 1', 'Lata 350ml'],
        ['Guaraná Antarctica Lata', 'Refrigerantes', 'Antarctica', '7891991000813', 30, 12, 'UN', 2.20, 5.50, 'Geladeira 1', 'Lata 350ml'],
        ['Água Mineral 500ml', 'Água', 'Indaiá', '7896048200012', 100, 24, 'UN', 0.80, 4.00, 'Depósito A', 'Sem gás'],
        ['Heineken Long Neck', 'Cervejas', 'Heineken', '7891050001010', 18, 24, 'UN', 4.50, 12.00, 'Geladeira 2', 'Estoque baixo'],
        ['Brahma Duplo Malte', 'Cervejas', 'Ambev', '7891149108018', 0, 12, 'UN', 3.20, 8.00, 'Geladeira 2', 'Em falta'],
        ['Skol Palito', 'Cervejas', 'Ambev', '7891149000114', 60, 24, 'UN', 2.80, 7.00, 'Depósito B', ''],
        ['Red Bull Energy Drink', 'Energéticos', 'Red Bull', '90162602', 15, 10, 'UN', 7.00, 16.00, 'Geladeira 1', '250ml'],
        ['Gelo 5kg', 'Gelo', 'IceBar', '1122334455667', 8, 5, 'UN', 3.00, 10.00, 'Freezer 1', 'Pacote']
      ];
      const stmt = db.prepare(`INSERT INTO products (name, category, brand, barcode, quantity, min_stock, unit, cost_price, sell_price, location, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      initProducts.forEach(p => stmt.run(p));
      stmt.finalize();
    }
  });
});

// Middlewares Autenticação
function authMiddleware(req, res, next) {
  if (req.session.user) next();
  else res.status(401).json({ error: 'Não autorizado' });
}

function adminMiddleware(req, res, next) {
  if (req.session.user && req.session.user.role === 'ADMINISTRADOR') next();
  else res.status(403).json({ error: 'Acesso negado: Requer privilégios de Administrador' });
}

// Rotas de Autenticação
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'Usuário ou senha incorretos' });
    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(400).json({ error: 'Usuário ou senha incorretos' });
    }
    req.session.user = { id: user.id, name: user.name, username: user.username, role: user.role };
    res.json({ message: 'Login realizado com sucesso', user: req.session.user });
  });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logout realizado' });
});

app.get('/api/auth/me', (req, res) => {
  if (req.session.user) res.json(req.session.user);
  else res.status(401).json({ error: 'Não autenticado' });
});

// Rotas de Usuários
app.post('/api/users', authMiddleware, adminMiddleware, (req, res) => {
  const { name, username, password, role } = req.body;
  if (!name || !username || !password || !role) return res.status(400).json({ error: 'Campos obrigatórios' });
  const hash = bcrypt.hashSync(password, 10);
  db.run(`INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)`, [name, username, hash, role], function(err) {
    if (err) return res.status(400).json({ error: 'Usuário já existe ou dados inválidos' });
    res.json({ id: this.lastID, name, username, role });
  });
});

// Rotas de Produtos
app.get('/api/products', authMiddleware, (req, res) => {
  db.all(`SELECT * FROM products ORDER BY name ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/products', authMiddleware, adminMiddleware, (req, res) => {
  const { name, category, brand, barcode, quantity, min_stock, unit, cost_price, sell_price, location, notes } = req.body;
  db.run(`INSERT INTO products (name, category, brand, barcode, quantity, min_stock, unit, cost_price, sell_price, location, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, category, brand, barcode, quantity || 0, min_stock || 0, unit || 'UN', cost_price || 0, sell_price || 0, location, notes],
    function(err) {
      if (err) return res.status(400).json({ error: 'Código de barras já cadastrado ou dados inválidos' });
      res.json({ id: this.lastID, message: 'Produto cadastrado com sucesso' });
    }
  );
});

app.put('/api/products/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { name, category, brand, barcode, min_stock, unit, cost_price, sell_price, location, notes } = req.body;
  db.run(`UPDATE products SET name=?, category=?, brand=?, barcode=?, min_stock=?, unit=?, cost_price=?, sell_price=?, location=?, notes=? WHERE id=?`,
    [name, category, brand, barcode, min_stock, unit, cost_price, sell_price, location, notes, req.params.id],
    function(err) {
      if (err) return res.status(400).json({ error: err.message });
      res.json({ message: 'Produto atualizado' });
    }
  );
});

app.delete('/api/products/:id', authMiddleware, adminMiddleware, (req, res) => {
  db.run(`DELETE FROM products WHERE id=?`, [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Produto excluído' });
  });
});

// Rotas de Movimentação
app.post('/api/movements', authMiddleware, (req, res) => {
  const { product_id, type, quantity, notes } = req.body;
  const qty = parseInt(quantity);
  
  db.get(`SELECT * FROM products WHERE id = ?`, [product_id], (err, product) => {
    if (err || !product) return res.status(404).json({ error: 'Produto não encontrado' });

    let new_stock = product.quantity;
    if (type === 'ENTRADA') new_stock += qty;
    else if (type === 'SAÍDA' || type === 'PERDA') new_stock -= qty;
    else if (type === 'AJUSTE') new_stock = qty;

    if (new_stock < 0) return res.status(400).json({ error: 'Estoque não pode ficar negativo' });

    db.run(`UPDATE products SET quantity = ? WHERE id = ?`, [new_stock, product_id], (err) => {
      if (err) return res.status(500).json({ error: err.message });

      db.run(`INSERT INTO movements (product_id, type, quantity, prev_stock, new_stock, user_name, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [product_id, type, qty, product.quantity, new_stock, req.session.user.name, notes],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'Movimentação registrada com sucesso', new_stock });
        }
      );
    });
  });
});

app.get('/api/movements', authMiddleware, (req, res) => {
  db.all(`SELECT m.*, p.name as product_name FROM movements m JOIN products p ON m.product_id = p.id ORDER BY m.timestamp DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Rotas de Conferência
app.post('/api/conferences', authMiddleware, (req, res) => {
  const { product_id, found_stock } = req.body;
  
  db.get(`SELECT * FROM products WHERE id = ?`, [product_id], (err, product) => {
    if (err || !product) return res.status(404).json({ error: 'Produto não encontrado' });

    const diff = found_stock - product.quantity;
    db.run(`INSERT INTO conferences (product_id, registered_stock, found_stock, difference, user_name) VALUES (?, ?, ?, ?, ?)`,
      [product_id, product.quantity, found_stock, diff, req.session.user.name],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, registered_stock: product.quantity, found_stock, difference: diff });
      }
    );
  });
});

app.get('/api/reports', authMiddleware, (req, res) => {
  const period = req.query.period || '7';
  let dateFilter = "DATETIME('now', '-7 days')";
  if (period === 'today') dateFilter = "DATETIME('now', 'start of day')";
  else if (period === '30') dateFilter = "DATETIME('now', '-30 days')";

  const reports = {};

  db.all(`SELECT p.name, SUM(m.quantity) as total FROM movements m JOIN products p ON m.product_id = p.id WHERE m.type='SAÍDA' AND m.timestamp >= ${dateFilter} GROUP BY p.id ORDER BY total DESC LIMIT 5`, [], (err, topSales) => {
    reports.topSales = topSales || [];
    db.all(`SELECT p.name, SUM(m.quantity) as total FROM movements m JOIN products p ON m.product_id = p.id WHERE m.type='PERDA' AND m.timestamp >= ${dateFilter} GROUP BY p.id ORDER BY total DESC LIMIT 5`, [], (err, topLosses) => {
      reports.topLosses = topLosses || [];
      db.all(`SELECT p.name, COUNT(c.id) as total FROM conferences c JOIN products p ON c.product_id = p.id WHERE c.difference != 0 AND c.timestamp >= ${dateFilter} GROUP BY p.id ORDER BY total DESC LIMIT 5`, [], (err, topDiffs) => {
        reports.topDiffs = topDiffs || [];
        res.json(reports);
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}: http://localhost:${PORT}`);
});