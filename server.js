const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'meridian.db');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let db;

async function initDatabase() {
  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('Created new database');
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS consultations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      area TEXT,
      preferred_date TEXT,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      items TEXT,
      total REAL,
      customer_name TEXT,
      customer_email TEXT,
      status TEXT DEFAULT 'paid',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS knowledge (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keywords TEXT,
      answer TEXT,
      category TEXT
    );
  `);

  // Seed products if empty
  const productCount = db.exec("SELECT COUNT(*) as c FROM products")[0]?.values[0][0] || 0;
  if (productCount === 0) {
    const products = [
      ['Initial Consultation (60 min)', 'In-depth strategy session with a partner. Includes written summary.', 350],
      ['Contract Review Package', 'Comprehensive review and redlining of up to 3 commercial contracts.', 650],
      ['Estate Planning Bundle', 'Will, revocable trust, healthcare directives, and power of attorney.', 1450],
      ['Trademark Search & Filing', 'Full clearance search + USPTO application preparation.', 890],
      ['Employment Agreement Review', 'Review and revision of executive or employee agreements.', 480],
      ['Business Formation Package', 'LLC or corporation formation + basic operating agreement.', 1200]
    ];
    const insert = db.prepare("INSERT INTO products (name, description, price) VALUES (?, ?, ?)");
    for (const p of products) insert.run(p);
    insert.free();
  }

  // Seed knowledge base if empty
  const kbCount = db.exec("SELECT COUNT(*) as c FROM knowledge")[0]?.values[0][0] || 0;
  if (kbCount === 0) {
    const kbItems = [
      ['consultation cost price fee', 'An initial 60-minute consultation with a partner is $350 and includes a written strategy summary.', 'consulting'],
      ['practice areas services', 'We handle Corporate & M&A, Intellectual Property, Employment Law, Family & Estate Planning, and Commercial Litigation.', 'consulting'],
      ['how to book schedule consultation', 'Go to the Consult section, fill out the form with your details and preferred date, then submit. We reply within one business day.', 'interface'],
      ['how to use store cart checkout', 'Browse the Store, click Add to Cart on any service, open the cart (top right), then Proceed to Payment. Payment is simulated for demo purposes.', 'interface'],
      ['estate planning cost', 'The Estate Planning Bundle (will, trust, POA, healthcare directives) is $1,450.', 'products'],
      ['trademark process cost', 'Trademark Search & Filing package is $890 and includes clearance search plus USPTO filing.', 'products'],
      ['payment plans retainer', 'For matters over $2,000 we offer structured payment plans. Retainers are discussed at the start of engagement.', 'consulting'],
      ['prepare for consultation', 'Bring relevant documents, contracts, correspondence, and a clear timeline of events.', 'consulting'],
      ['confidentiality privilege', 'All communications become protected by attorney-client privilege once an engagement is formed.', 'consulting'],
      ['what we do not handle', 'We do not handle criminal defense, personal injury, or immigration matters.', 'consulting'],
      ['how long cases take', 'Simple contracts can be done in days; complex litigation may take months to years. We give realistic timelines after review.', 'consulting']
    ];
    const insertKB = db.prepare("INSERT INTO knowledge (keywords, answer, category) VALUES (?, ?, ?)");
    for (const item of kbItems) insertKB.run(item);
    insertKB.free();
  }

  saveDatabase();
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Helper to run queries and get results as objects
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
  saveDatabase();
}

// API Routes
app.get('/api/products', (req, res) => {
  const products = query('SELECT * FROM products');
  res.json(products);
});

app.post('/api/consult', (req, res) => {
  const { name, email, phone, area, preferred_date, message } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });

  run(`
    INSERT INTO consultations (name, email, phone, area, preferred_date, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [name, email, phone || '', area || '', preferred_date || '', message || '']);

  res.json({ success: true });
});

app.post('/api/checkout', (req, res) => {
  const { items, total, customer_name, customer_email } = req.body;
  if (!items || !total) return res.status(400).json({ error: 'Invalid order' });

  run(`
    INSERT INTO orders (items, total, customer_name, customer_email)
    VALUES (?, ?, ?, ?)
  `, [JSON.stringify(items), total, customer_name || '', customer_email || '']);

  res.json({ success: true });
});

app.post('/api/chat', (req, res) => {
  const { message } = req.body;
  if (!message) return res.json({ reply: 'Please type a question.' });

  const lower = message.toLowerCase();
  const rows = query('SELECT * FROM knowledge');

  let reply = "I can help with information about our legal services, consultation process, store products, or how to use this website. Try asking about consultation fees, practice areas, estate planning, or how to check out.";

  for (const row of rows) {
    const keywords = row.keywords.toLowerCase().split(/\s+/);
    if (keywords.some(kw => lower.includes(kw) && kw.length > 3)) {
      reply = row.answer;
      break;
    }
  }

  if (lower.includes('product') || lower.includes('package') || lower.includes('price') || lower.includes('cost')) {
    const products = query('SELECT name, price FROM products');
    const list = products.map(p => `${p.name}: $${p.price}`).join(' | ');
    reply += `\n\nCurrent packages: ${list}`;
  }

  res.json({ reply });
});

// Start server after DB is ready
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Meridian Legal running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});