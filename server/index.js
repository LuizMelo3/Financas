'use strict';

const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');
const initSql  = require('sql.js');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

const app        = express();
const PORT       = process.env.PORT || 3000;
const DB_PATH    = path.join(process.env.DATA_DIR || __dirname, 'finance.db');
const JWT_SECRET = process.env.JWT_SECRET || 'financeiro_secret_2024';

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../client/dist')));

// ── DB helpers ────────────────────────────────────────────
let db;
function save() {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}
function all(sql, p = []) {
  const s = db.prepare(sql); if (p.length) s.bind(p);
  const rows = []; while (s.step()) rows.push(s.getAsObject()); s.free();
  return rows;
}
function get(sql, p = [])  { return all(sql, p)[0] || null; }
function run(sql, p = [])  { db.run(sql, p); save(); }
function uid()             { return crypto.randomUUID(); }
function localDateStr(d)   { const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
function parseLocalDate(s) { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
function today()           { return localDateStr(new Date()); }

// ── Schema ────────────────────────────────────────────────
function createSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, bank TEXT, type TEXT DEFAULT 'corrente',
      initial_balance REAL DEFAULT 0, color TEXT DEFAULT '#6366f1', created_at TEXT NOT NULL,
      user_id TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1', icon TEXT DEFAULT '📌', custom INTEGER DEFAULT 0,
      user_id TEXT
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, description TEXT NOT NULL,
      amount REAL NOT NULL, date TEXT NOT NULL, due_date TEXT, paid_date TEXT,
      category TEXT, account_id TEXT, status TEXT DEFAULT 'received',
      recurrence TEXT DEFAULT 'once', notes TEXT, created_at TEXT NOT NULL,
      user_id TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS debts (
      id TEXT PRIMARY KEY, description TEXT NOT NULL, creditor TEXT,
      total_amount REAL NOT NULL, installments INTEGER NOT NULL,
      paid_installments INTEGER DEFAULT 0, interest_rate REAL DEFAULT 0,
      first_date TEXT NOT NULL, category TEXT DEFAULT 'Outros',
      account_id TEXT, created_at TEXT NOT NULL,
      user_id TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS debt_payments (
      id TEXT PRIMARY KEY, debt_id TEXT NOT NULL, amount REAL NOT NULL,
      date TEXT NOT NULL, installment_number INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS investments (
      id TEXT PRIMARY KEY, description TEXT NOT NULL, type TEXT DEFAULT 'CDB',
      institution TEXT, amount REAL NOT NULL, date TEXT NOT NULL,
      monthly_rate REAL DEFAULT 0, maturity_date TEXT,
      liquidity TEXT DEFAULT 'diaria', account_id TEXT, created_at TEXT NOT NULL,
      user_id TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS investment_withdrawals (
      id TEXT PRIMARY KEY, investment_id TEXT NOT NULL, amount REAL NOT NULL,
      date TEXT NOT NULL, to_account_id TEXT
    );
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
      target_amount REAL NOT NULL, current_amount REAL DEFAULT 0,
      deadline TEXT, category TEXT DEFAULT 'Outros',
      status TEXT DEFAULT 'active', color TEXT DEFAULT '#6366f1',
      icon TEXT DEFAULT '🎯', created_at TEXT NOT NULL,
      user_id TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS goal_contributions (
      id TEXT PRIMARY KEY, goal_id TEXT NOT NULL, amount REAL NOT NULL,
      date TEXT NOT NULL, notes TEXT
    );
    CREATE TABLE IF NOT EXISTS credit_cards (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, limit_total REAL NOT NULL,
      closing_day INTEGER NOT NULL, due_day INTEGER NOT NULL,
      account_id TEXT, color TEXT DEFAULT '#6366f1', created_at TEXT NOT NULL,
      user_id TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS credit_card_purchases (
      id TEXT PRIMARY KEY, card_id TEXT NOT NULL, description TEXT NOT NULL,
      total_amount REAL NOT NULL, installments INTEGER DEFAULT 1,
      category TEXT, date TEXT NOT NULL, paid INTEGER DEFAULT 0,
      bill_month TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY, category TEXT NOT NULL, month TEXT NOT NULL,
      amount REAL NOT NULL, created_at TEXT NOT NULL, user_id TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS transfers (
      id TEXT PRIMARY KEY, from_account_id TEXT NOT NULL,
      to_account_id TEXT NOT NULL, amount REAL NOT NULL,
      date TEXT NOT NULL, notes TEXT, created_at TEXT NOT NULL,
      user_id TEXT DEFAULT ''
    );
  `);

  // Adicionar colunas user_id em tabelas já existentes (ignora erro se já existe)
  [
    'ALTER TABLE accounts ADD COLUMN user_id TEXT DEFAULT ""',
    'ALTER TABLE transactions ADD COLUMN user_id TEXT DEFAULT ""',
    'ALTER TABLE debts ADD COLUMN user_id TEXT DEFAULT ""',
    'ALTER TABLE investments ADD COLUMN user_id TEXT DEFAULT ""',
    'ALTER TABLE goals ADD COLUMN user_id TEXT DEFAULT ""',
    'ALTER TABLE credit_cards ADD COLUMN user_id TEXT DEFAULT ""',
    'ALTER TABLE budgets ADD COLUMN user_id TEXT DEFAULT ""',
    'ALTER TABLE transfers ADD COLUMN user_id TEXT DEFAULT ""',
    'ALTER TABLE categories ADD COLUMN user_id TEXT',
  ].forEach(sql => { try { db.run(sql); } catch (_) {} });

  save();
}

// ── Default categories (globais, user_id NULL) ────────────
function seedCategories() {
  const existing = get('SELECT COUNT(*) as c FROM categories WHERE user_id IS NULL');
  if (existing && existing.c > 0) return;
  const cats = [
    { name:'Salário',           type:'income',  color:'#10b981', icon:'💼' },
    { name:'Freelance',         type:'income',  color:'#6366f1', icon:'💻' },
    { name:'Rendimento',        type:'income',  color:'#f59e0b', icon:'📈' },
    { name:'Aluguel recebido',  type:'income',  color:'#14b8a6', icon:'🏠' },
    { name:'Venda',             type:'income',  color:'#8b5cf6', icon:'🛒' },
    { name:'Outros (receita)',  type:'income',  color:'#94a3b8', icon:'➕' },
    { name:'Moradia',           type:'expense', color:'#f43f5e', icon:'🏠' },
    { name:'Alimentação',       type:'expense', color:'#f97316', icon:'🍽️' },
    { name:'Transporte',        type:'expense', color:'#eab308', icon:'🚗' },
    { name:'Saúde',             type:'expense', color:'#ef4444', icon:'❤️' },
    { name:'Educação',          type:'expense', color:'#3b82f6', icon:'📚' },
    { name:'Lazer',             type:'expense', color:'#a855f7', icon:'🎮' },
    { name:'Vestuário',         type:'expense', color:'#ec4899', icon:'👗' },
    { name:'Utilidades',        type:'expense', color:'#06b6d4', icon:'💡' },
    { name:'Assinaturas',       type:'expense', color:'#8b5cf6', icon:'📱' },
    { name:'Pets',              type:'expense', color:'#84cc16', icon:'🐾' },
    { name:'Impostos',          type:'expense', color:'#6b7280', icon:'📋' },
    { name:'Outros (despesa)',  type:'expense', color:'#94a3b8', icon:'➖' },
  ];
  cats.forEach(c => db.run(
    'INSERT INTO categories (id,name,type,color,icon) VALUES (?,?,?,?,?)',
    [uid(), c.name, c.type, c.color, c.icon]
  ));
  save();
}

// ── Auth middleware ───────────────────────────────────────
function authenticateToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Não autorizado' });
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// ── Auth routes ───────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Dados incompletos' });
    if (password.length < 6) return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
    const existing = get('SELECT id FROM users WHERE email=?', [email]);
    if (existing) return res.status(400).json({ error: 'E-mail já cadastrado' });
    const password_hash = await bcrypt.hash(password, 10);
    const id = uid();
    run('INSERT INTO users VALUES (?,?,?,?,?)', [id, name, email, password_hash, today()]);
    const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id, name, email } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Dados incompletos' });
    const user = get('SELECT * FROM users WHERE email=?', [email]);
    if (!user) return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = get('SELECT id, name, email FROM users WHERE id=?', [req.userId]);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json(user);
});

// ── ACCOUNTS ──────────────────────────────────────────────
function accountBalance(id) {
  const acc = get('SELECT initial_balance FROM accounts WHERE id=?', [id]);
  if (!acc) return 0;
  const inc  = get(`SELECT COALESCE(SUM(amount),0) as s FROM transactions WHERE account_id=? AND type='income' AND status IN ('received','paid')`, [id]);
  const exp  = get(`SELECT COALESCE(SUM(amount),0) as s FROM transactions WHERE account_id=? AND type='expense' AND status='paid'`, [id]);
  const dp   = get(`SELECT COALESCE(SUM(dp.amount),0) as s FROM debt_payments dp JOIN debts d ON d.id=dp.debt_id WHERE d.account_id=?`, [id]);
  const tin  = get(`SELECT COALESCE(SUM(amount),0) as s FROM transfers WHERE to_account_id=?`, [id]);
  const tout = get(`SELECT COALESCE(SUM(amount),0) as s FROM transfers WHERE from_account_id=?`, [id]);
  const iw   = get(`SELECT COALESCE(SUM(iw.amount),0) as s FROM investment_withdrawals iw WHERE iw.to_account_id=?`, [id]);
  return (acc.initial_balance||0) + (inc?.s||0) - (exp?.s||0) - (dp?.s||0)
       + (tin?.s||0) - (tout?.s||0) + (iw?.s||0);
}

app.get('/api/accounts', authenticateToken, (req, res) => {
  const rows = all('SELECT * FROM accounts WHERE user_id=? ORDER BY created_at', [req.userId]);
  res.json(rows.map(a => ({ ...a, balance: accountBalance(a.id) })));
});

app.post('/api/accounts', authenticateToken, (req, res) => {
  const { name, bank, type, initial_balance, color } = req.body;
  const id = uid();
  run('INSERT INTO accounts (id,name,bank,type,initial_balance,color,created_at,user_id) VALUES (?,?,?,?,?,?,?,?)',
    [id, name, bank||'', type||'corrente', initial_balance||0, color||'#6366f1', today(), req.userId]);
  res.json({ id });
});

app.put('/api/accounts/:id', authenticateToken, (req, res) => {
  const { name, bank, type, color } = req.body;
  run('UPDATE accounts SET name=?,bank=?,type=?,color=? WHERE id=? AND user_id=?',
    [name, bank||'', type||'corrente', color||'#6366f1', req.params.id, req.userId]);
  res.json({ ok: true });
});

app.delete('/api/accounts/:id', authenticateToken, (req, res) => {
  run('DELETE FROM accounts WHERE id=? AND user_id=?', [req.params.id, req.userId]);
  res.json({ ok: true });
});

// ── TRANSFERS ─────────────────────────────────────────────
app.post('/api/transfers', authenticateToken, (req, res) => {
  const { from_account_id, to_account_id, amount, date, notes } = req.body;
  run('INSERT INTO transfers (id,from_account_id,to_account_id,amount,date,notes,created_at,user_id) VALUES (?,?,?,?,?,?,?,?)',
    [uid(), from_account_id, to_account_id, amount, date||today(), notes||'', today(), req.userId]);
  res.json({ ok: true });
});

// ── TRANSACTIONS ──────────────────────────────────────────
app.get('/api/transactions', authenticateToken, (req, res) => {
  let sql = 'SELECT * FROM transactions WHERE user_id=?';
  const p = [req.userId];
  if (req.query.type)       { sql += ' AND type=?';       p.push(req.query.type); }
  if (req.query.account_id) { sql += ' AND account_id=?'; p.push(req.query.account_id); }
  if (req.query.category)   { sql += ' AND category=?';   p.push(req.query.category); }
  if (req.query.status)     { sql += ' AND status=?';     p.push(req.query.status); }
  if (req.query.from)       { sql += ' AND date>=?';      p.push(req.query.from); }
  if (req.query.to)         { sql += ' AND date<=?';      p.push(req.query.to); }
  sql += ' ORDER BY date DESC, created_at DESC';
  res.json(all(sql, p));
});

app.post('/api/transactions', authenticateToken, (req, res) => {
  const { type, description, amount, date, due_date, category, account_id, status, recurrence, notes } = req.body;
  const id = uid();
  const paid_date = (status === 'paid' || status === 'received') ? (date||today()) : null;
  run('INSERT INTO transactions (id,type,description,amount,date,due_date,paid_date,category,account_id,status,recurrence,notes,created_at,user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, type, description, parseFloat(amount), date||today(), due_date||null, paid_date,
     category||'', account_id||null, status||'received', recurrence||'once', notes||'', today(), req.userId]);
  res.json({ id });
});

app.put('/api/transactions/:id', authenticateToken, (req, res) => {
  const { description, amount, date, due_date, category, account_id, status, recurrence, notes, paid_date } = req.body;
  run(`UPDATE transactions SET description=?,amount=?,date=?,due_date=?,paid_date=?,
    category=?,account_id=?,status=?,recurrence=?,notes=? WHERE id=? AND user_id=?`,
    [description, amount, date, due_date||null, paid_date||null,
     category||'', account_id||null, status||'received', recurrence||'once', notes||'', req.params.id, req.userId]);
  res.json({ ok: true });
});

app.delete('/api/transactions/:id', authenticateToken, (req, res) => {
  run('DELETE FROM transactions WHERE id=? AND user_id=?', [req.params.id, req.userId]);
  res.json({ ok: true });
});

app.post('/api/transactions/:id/pay', authenticateToken, (req, res) => {
  run(`UPDATE transactions SET status='paid', paid_date=? WHERE id=? AND user_id=?`,
    [today(), req.params.id, req.userId]);
  res.json({ ok: true });
});

// ── DEBTS ─────────────────────────────────────────────────
function debtInstallmentValue(d) {
  const rate = parseFloat(d.interest_rate) || 0;
  if (rate === 0) return d.total_amount / d.installments;
  const r = rate / 100;
  return d.total_amount * (r * Math.pow(1+r, d.installments)) / (Math.pow(1+r, d.installments) - 1);
}

app.get('/api/debts', authenticateToken, (req, res) => {
  const debts = all('SELECT * FROM debts WHERE user_id=? ORDER BY created_at DESC', [req.userId]);
  res.json(debts.map(d => {
    const inst = debtInstallmentValue(d);
    const totalWithInterest = inst * d.installments;
    const paidAmount = inst * d.paid_installments;
    const remaining = inst * (d.installments - d.paid_installments);
    const nextDate = d.first_date ? (() => {
      const dt = parseLocalDate(d.first_date);
      dt.setMonth(dt.getMonth() + d.paid_installments);
      return localDateStr(dt);
    })() : null;
    return { ...d, installment_value: inst, total_with_interest: totalWithInterest,
      paid_amount: paidAmount, remaining_amount: remaining, next_date: nextDate };
  }));
});

app.post('/api/debts', authenticateToken, (req, res) => {
  const { description, creditor, total_amount, installments, remaining_installments, next_date, interest_rate, category, account_id } = req.body;
  const total     = parseInt(installments);
  const remaining = parseInt(remaining_installments) || total;
  const paid      = Math.max(0, total - remaining);
  const nd = parseLocalDate(next_date || today());
  nd.setMonth(nd.getMonth() - paid);
  nd.setDate(1);
  const first_date = localDateStr(nd);
  const id = uid();
  run('INSERT INTO debts (id,description,creditor,total_amount,installments,paid_installments,interest_rate,first_date,category,account_id,created_at,user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, description, creditor||'', total_amount, total,
     paid, interest_rate||0, first_date, category||'Outros', account_id||null, today(), req.userId]);
  res.json({ id });
});

app.put('/api/debts/:id', authenticateToken, (req, res) => {
  const { description, creditor, total_amount, installments, interest_rate, first_date, category, account_id } = req.body;
  run('UPDATE debts SET description=?,creditor=?,total_amount=?,installments=?,interest_rate=?,first_date=?,category=?,account_id=? WHERE id=? AND user_id=?',
    [description, creditor||'', total_amount, installments, interest_rate||0, first_date, category||'Outros', account_id||null, req.params.id, req.userId]);
  res.json({ ok: true });
});

app.post('/api/debts/:id/pay', authenticateToken, (req, res) => {
  const d = get('SELECT * FROM debts WHERE id=? AND user_id=?', [req.params.id, req.userId]);
  if (!d) return res.status(404).json({ error: 'Não encontrado' });
  if (d.paid_installments >= d.installments) return res.status(400).json({ error: 'Dívida já quitada' });
  const inst  = debtInstallmentValue(d);
  const payNo = d.paid_installments + 1;
  run('INSERT INTO debt_payments VALUES (?,?,?,?,?)', [uid(), d.id, inst, today(), payNo]);
  run('UPDATE debts SET paid_installments=? WHERE id=?', [payNo, d.id]);
  res.json({ ok: true, amount: inst });
});

app.delete('/api/debts/:id', authenticateToken, (req, res) => {
  run('DELETE FROM debt_payments WHERE debt_id=?', [req.params.id]);
  run('DELETE FROM debts WHERE id=? AND user_id=?', [req.params.id, req.userId]);
  res.json({ ok: true });
});

// ── INVESTMENTS ───────────────────────────────────────────
function currentInvestmentValue(inv) {
  const months = (Date.now() - new Date(inv.date).getTime()) / (1000*60*60*24*30.44);
  const withdrawn = get('SELECT COALESCE(SUM(amount),0) as s FROM investment_withdrawals WHERE investment_id=?', [inv.id]);
  const wAmt = withdrawn?.s || 0;
  if (!inv.monthly_rate) return Math.max(0, inv.amount - wAmt);
  return Math.max(0, inv.amount * Math.pow(1 + inv.monthly_rate/100, months) - wAmt);
}

app.get('/api/investments', authenticateToken, (req, res) => {
  const invs = all('SELECT * FROM investments WHERE user_id=? ORDER BY created_at DESC', [req.userId]);
  res.json(invs.map(i => {
    const current = currentInvestmentValue(i);
    const gain    = current - i.amount;
    const gainPct = i.amount > 0 ? (gain/i.amount)*100 : 0;
    return { ...i, current_value: current, gain, gain_pct: gainPct };
  }));
});

app.post('/api/investments', authenticateToken, (req, res) => {
  const { description, type, institution, amount, date, monthly_rate, maturity_date, liquidity, account_id } = req.body;
  const id = uid();
  run('INSERT INTO investments (id,description,type,institution,amount,date,monthly_rate,maturity_date,liquidity,account_id,created_at,user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, description, type||'CDB', institution||'', amount, date||today(),
     monthly_rate||0, maturity_date||null, liquidity||'diaria', account_id||null, today(), req.userId]);
  res.json({ id });
});

app.put('/api/investments/:id', authenticateToken, (req, res) => {
  const { description, type, institution, monthly_rate, maturity_date, liquidity } = req.body;
  run('UPDATE investments SET description=?,type=?,institution=?,monthly_rate=?,maturity_date=?,liquidity=? WHERE id=? AND user_id=?',
    [description, type||'CDB', institution||'', monthly_rate||0, maturity_date||null, liquidity||'diaria', req.params.id, req.userId]);
  res.json({ ok: true });
});

app.post('/api/investments/:id/withdraw', authenticateToken, (req, res) => {
  const inv = get('SELECT id FROM investments WHERE id=? AND user_id=?', [req.params.id, req.userId]);
  if (!inv) return res.status(404).json({ error: 'Não encontrado' });
  const { amount, to_account_id } = req.body;
  run('INSERT INTO investment_withdrawals VALUES (?,?,?,?,?)',
    [uid(), req.params.id, amount, today(), to_account_id||null]);
  res.json({ ok: true });
});

app.delete('/api/investments/:id', authenticateToken, (req, res) => {
  run('DELETE FROM investment_withdrawals WHERE investment_id=?', [req.params.id]);
  run('DELETE FROM investments WHERE id=? AND user_id=?', [req.params.id, req.userId]);
  res.json({ ok: true });
});

// ── GOALS ─────────────────────────────────────────────────
app.get('/api/goals', authenticateToken, (req, res) => {
  const goals = all('SELECT * FROM goals WHERE user_id=? ORDER BY created_at DESC', [req.userId]);
  res.json(goals.map(g => ({
    ...g,
    pct: g.target_amount > 0 ? Math.min(100, (g.current_amount/g.target_amount)*100) : 0,
  })));
});

app.post('/api/goals', authenticateToken, (req, res) => {
  const { name, description, target_amount, deadline, category, color, icon } = req.body;
  const id = uid();
  run('INSERT INTO goals (id,name,description,target_amount,current_amount,deadline,category,status,color,icon,created_at,user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, name, description||'', target_amount, 0, deadline||null, category||'Outros', 'active', color||'#6366f1', icon||'🎯', today(), req.userId]);
  res.json({ id });
});

app.put('/api/goals/:id', authenticateToken, (req, res) => {
  const { name, description, target_amount, deadline, category, status, color, icon } = req.body;
  run('UPDATE goals SET name=?,description=?,target_amount=?,deadline=?,category=?,status=?,color=?,icon=? WHERE id=? AND user_id=?',
    [name, description||'', target_amount, deadline||null, category||'Outros', status||'active', color||'#6366f1', icon||'🎯', req.params.id, req.userId]);
  res.json({ ok: true });
});

app.post('/api/goals/:id/contribute', authenticateToken, (req, res) => {
  const g = get('SELECT * FROM goals WHERE id=? AND user_id=?', [req.params.id, req.userId]);
  if (!g) return res.status(404).json({ error: 'Não encontrado' });
  const { amount, notes } = req.body;
  run('INSERT INTO goal_contributions VALUES (?,?,?,?,?)', [uid(), g.id, amount, today(), notes||'']);
  run('UPDATE goals SET current_amount=current_amount+? WHERE id=?', [amount, g.id]);
  const updated = get('SELECT * FROM goals WHERE id=?', [g.id]);
  if (updated && updated.current_amount >= updated.target_amount)
    run("UPDATE goals SET status='completed' WHERE id=?", [g.id]);
  res.json({ ok: true });
});

app.delete('/api/goals/:id', authenticateToken, (req, res) => {
  run('DELETE FROM goal_contributions WHERE goal_id=?', [req.params.id]);
  run('DELETE FROM goals WHERE id=? AND user_id=?', [req.params.id, req.userId]);
  res.json({ ok: true });
});

// ── CREDIT CARDS ──────────────────────────────────────────
app.get('/api/credit-cards', authenticateToken, (req, res) => {
  const cards = all('SELECT * FROM credit_cards WHERE user_id=? ORDER BY created_at', [req.userId]);
  res.json(cards.map(c => {
    const used = get(`SELECT COALESCE(SUM(total_amount),0) as s FROM credit_card_purchases WHERE card_id=? AND paid=0`, [c.id]);
    return { ...c, used: used?.s||0, available: c.limit_total - (used?.s||0) };
  }));
});

app.post('/api/credit-cards', authenticateToken, (req, res) => {
  const { name, limit_total, closing_day, due_day, account_id, color } = req.body;
  const id = uid();
  run('INSERT INTO credit_cards (id,name,limit_total,closing_day,due_day,account_id,color,created_at,user_id) VALUES (?,?,?,?,?,?,?,?,?)',
    [id, name, limit_total, closing_day||5, due_day||15, account_id||null, color||'#6366f1', today(), req.userId]);
  res.json({ id });
});

app.delete('/api/credit-cards/:id', authenticateToken, (req, res) => {
  run('DELETE FROM credit_card_purchases WHERE card_id=?', [req.params.id]);
  run('DELETE FROM credit_cards WHERE id=? AND user_id=?', [req.params.id, req.userId]);
  res.json({ ok: true });
});

app.get('/api/credit-cards/:id/purchases', authenticateToken, (req, res) => {
  const card = get('SELECT id FROM credit_cards WHERE id=? AND user_id=?', [req.params.id, req.userId]);
  if (!card) return res.status(404).json({ error: 'Não encontrado' });
  res.json(all('SELECT * FROM credit_card_purchases WHERE card_id=? ORDER BY date DESC', [req.params.id]));
});

app.post('/api/credit-cards/:id/purchase', authenticateToken, (req, res) => {
  const card = get('SELECT id FROM credit_cards WHERE id=? AND user_id=?', [req.params.id, req.userId]);
  if (!card) return res.status(404).json({ error: 'Não encontrado' });
  const { description, total_amount, installments, category, date, bill_month } = req.body;
  const id = uid();
  run('INSERT INTO credit_card_purchases VALUES (?,?,?,?,?,?,?,?,?,?)',
    [id, req.params.id, description, total_amount, installments||1, category||'', date||today(), 0, bill_month||null, today()]);
  res.json({ id });
});

app.post('/api/credit-cards/:cardId/purchases/:purchaseId/pay', authenticateToken, (req, res) => {
  const card = get('SELECT * FROM credit_cards WHERE id=? AND user_id=?', [req.params.cardId, req.userId]);
  if (!card) return res.status(404).json({ error: 'Não encontrado' });
  const purchase = get('SELECT * FROM credit_card_purchases WHERE id=?', [req.params.purchaseId]);
  if (!purchase) return res.status(404).json({ error: 'Não encontrado' });
  if (card?.account_id) {
    run('INSERT INTO transactions (id,type,description,amount,date,due_date,paid_date,category,account_id,status,recurrence,notes,created_at,user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [uid(),'expense',`Fatura ${card.name}`,purchase.total_amount,today(),null,today(),
       'Assinaturas',card.account_id,'paid','once','',today(), req.userId]);
  }
  run('UPDATE credit_card_purchases SET paid=1 WHERE id=?', [req.params.purchaseId]);
  res.json({ ok: true });
});

// ── BUDGETS ───────────────────────────────────────────────
app.get('/api/budgets', authenticateToken, (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0,7);
  const budgets = all('SELECT * FROM budgets WHERE user_id=? AND month=? ORDER BY category', [req.userId, month]);
  const spent = all(
    `SELECT category, COALESCE(SUM(amount),0) as total FROM transactions
     WHERE user_id=? AND type='expense' AND status='paid' AND date LIKE ? GROUP BY category`,
    [req.userId, month+'%']
  );
  const spentMap = {};
  spent.forEach(s => { spentMap[s.category] = s.total; });
  res.json(budgets.map(b => ({ ...b, spent: spentMap[b.category]||0 })));
});

app.post('/api/budgets', authenticateToken, (req, res) => {
  const { category, month, amount } = req.body;
  const userId = req.userId;
  const existing = get('SELECT id FROM budgets WHERE user_id=? AND category=? AND month=?', [userId, category, month]);
  if (existing) {
    run('UPDATE budgets SET amount=? WHERE id=?', [amount, existing.id]);
    res.json({ id: existing.id });
  } else {
    const id = uid();
    run('INSERT INTO budgets (id,category,month,amount,created_at,user_id) VALUES (?,?,?,?,?,?)',
      [id, category, month, amount, today(), userId]);
    res.json({ id });
  }
});

app.delete('/api/budgets/:id', authenticateToken, (req, res) => {
  run('DELETE FROM budgets WHERE id=? AND user_id=?', [req.params.id, req.userId]);
  res.json({ ok: true });
});

// ── CATEGORIES ────────────────────────────────────────────
// Globais (user_id IS NULL) + personalizadas do usuário
app.get('/api/categories', authenticateToken, (req, res) => {
  let sql = 'SELECT * FROM categories WHERE (user_id IS NULL OR user_id=?) ORDER BY name';
  const p = [req.userId];
  if (req.query.type) {
    sql = 'SELECT * FROM categories WHERE (user_id IS NULL OR user_id=?) AND type=? ORDER BY name';
    p.push(req.query.type);
  }
  res.json(all(sql, p));
});

app.post('/api/categories', authenticateToken, (req, res) => {
  const { name, type, color, icon } = req.body;
  const id = uid();
  run('INSERT INTO categories (id,name,type,color,icon,custom,user_id) VALUES (?,?,?,?,?,?,?)',
    [id, name, type, color||'#6366f1', icon||'📌', 1, req.userId]);
  res.json({ id });
});

app.put('/api/categories/:id', authenticateToken, (req, res) => {
  const { name, color, icon } = req.body;
  run('UPDATE categories SET name=?,color=?,icon=? WHERE id=? AND user_id=?',
    [name, color, icon, req.params.id, req.userId]);
  res.json({ ok: true });
});

app.delete('/api/categories/:id', authenticateToken, (req, res) => {
  run('DELETE FROM categories WHERE id=? AND custom=1 AND user_id=?', [req.params.id, req.userId]);
  res.json({ ok: true });
});

// ── DASHBOARD ─────────────────────────────────────────────
app.get('/api/dashboard', authenticateToken, (req, res) => {
  const userId = req.userId;
  const accs   = all('SELECT * FROM accounts WHERE user_id=?', [userId]);
  const totBal = accs.reduce((s, a) => s + accountBalance(a.id), 0);

  const month = today().slice(0,7);

  const mInc = get(`SELECT COALESCE(SUM(amount),0) as s FROM transactions
    WHERE user_id=? AND type='income' AND recurrence!='monthly' AND status IN ('received','paid') AND date LIKE ?`,
    [userId, month+'%']);

  const mExpPaid    = get(`SELECT COALESCE(SUM(amount),0) as s FROM transactions
    WHERE user_id=? AND type='expense' AND status='paid' AND recurrence!='monthly' AND date LIKE ?`,
    [userId, month+'%']);
  const mExpPending = get(`SELECT COALESCE(SUM(amount),0) as s FROM transactions
    WHERE user_id=? AND type='expense' AND status IN ('pending','overdue') AND recurrence!='monthly'
    AND (date LIKE ? OR due_date LIKE ?)`,
    [userId, month+'%', month+'%']);

  const recurringMonthly = all(`SELECT * FROM transactions WHERE user_id=? AND type='expense' AND recurrence='monthly'`, [userId]);
  const recurringActive  = recurringMonthly.filter(t => (t.date||'').slice(0,7) <= month);
  const recurringTotal   = recurringActive.reduce((s, t) => s + t.amount, 0);

  const recurringMonthlyIncome = all(`SELECT * FROM transactions WHERE user_id=? AND type='income' AND recurrence='monthly'`, [userId]);
  const recurringIncomeTotal   = recurringMonthlyIncome.reduce((s, t) => s + t.amount, 0);

  const debts       = all('SELECT * FROM debts WHERE user_id=?', [userId]);
  const activeDebts = debts.filter(d => d.paid_installments < d.installments);

  const totDebt = activeDebts.reduce((s, d) => {
    const inst = debtInstallmentValue(d);
    return s + parseFloat((inst * (d.installments - d.paid_installments)).toFixed(2));
  }, 0);

  function toMonths(year, month0) { return year * 12 + month0; }
  function debtHasPaymentInMonth(d, year, month0) {
    const remaining = d.installments - d.paid_installments;
    if (remaining <= 0 || !d.first_date) return false;
    const [fy, fm] = d.first_date.split('-').map(Number);
    const diff = toMonths(year, month0) - toMonths(fy, fm - 1);
    return diff >= d.paid_installments && diff < d.installments;
  }

  const now = new Date();
  const nowYear = now.getFullYear(), nowMonth = now.getMonth();
  const monthlyDebtTotal = activeDebts
    .filter(d => debtHasPaymentInMonth(d, nowYear, nowMonth))
    .reduce((s, d) => s + debtInstallmentValue(d), 0);

  const debtSchedule = [];
  for (let i = 0; i < 6; i++) {
    const tYear  = nowYear + Math.floor((nowMonth + i) / 12);
    const tMonth = (nowMonth + i) % 12;
    const m = `${tYear}-${String(tMonth + 1).padStart(2, '0')}`;

    const debtTotal = activeDebts
      .filter(d => debtHasPaymentInMonth(d, tYear, tMonth))
      .reduce((s, d) => s + debtInstallmentValue(d), 0);
    const debtsThisMonth = activeDebts
      .filter(d => debtHasPaymentInMonth(d, tYear, tMonth))
      .map(d => ({ name: d.description, value: parseFloat(debtInstallmentValue(d).toFixed(2)), kind: 'debt' }));

    const expRows = all(
      `SELECT description, SUM(amount) as amount FROM transactions
       WHERE user_id=? AND type='expense' AND recurrence!='monthly' AND date LIKE ? GROUP BY description`,
      [userId, m + '%']
    );
    const recurringThisMonth = recurringMonthly.filter(t => (t.date||'').slice(0,7) <= m);

    const expTotal = expRows.reduce((s, t) => s + t.amount, 0)
                  + recurringThisMonth.reduce((s, t) => s + t.amount, 0);
    const expItems = [
      ...expRows.map(t => ({ name: t.description, value: parseFloat(t.amount.toFixed(2)), kind: 'expense' })),
      ...recurringThisMonth.map(t => ({ name: t.description, value: parseFloat(t.amount.toFixed(2)), kind: 'fixed' })),
    ];

    debtSchedule.push({
      month: m,
      total: parseFloat((debtTotal + expTotal).toFixed(2)),
      debts: debtsThisMonth,
      expenses: expItems,
    });
  }

  const invs   = all('SELECT * FROM investments WHERE user_id=?', [userId]);
  const totInv = invs.reduce((s, i) => s + currentInvestmentValue(i), 0);
  const patrimonio = totBal + totInv - totDebt;

  const mExpTotal = (mExpPaid?.s||0) + (mExpPending?.s||0) + recurringTotal + monthlyDebtTotal;

  let score = 0;
  const income = (mInc?.s||0) + recurringIncomeTotal;
  if (totBal > 0) score += 20;
  if (income > 0 && mExpTotal/income < 0.7) score += 20;
  const hasReserva = get("SELECT 1 FROM goals WHERE user_id=? AND category='Reserva de emergência' AND status='active'", [userId]);
  if (hasReserva) score += 20;
  const overdue = get("SELECT COUNT(*) as c FROM transactions WHERE user_id=? AND type='expense' AND status='overdue'", [userId]);
  if (!overdue || overdue.c === 0) score += 20;
  const hasInv = get("SELECT 1 FROM investments WHERE user_id=? LIMIT 1", [userId]);
  if (hasInv) score += 20;

  const recent = all('SELECT * FROM transactions WHERE user_id=? ORDER BY date DESC, created_at DESC LIMIT 10', [userId]);

  const monthly = [];
  for (let i = 0; i < 12; i++) {
    const hYear  = nowYear;
    const hMonth = i;
    const m = `${hYear}-${String(hMonth + 1).padStart(2, '0')}`;
    const inc = get(`SELECT COALESCE(SUM(amount),0) as s FROM transactions
      WHERE user_id=? AND type='income' AND recurrence!='monthly' AND status IN ('received','paid') AND date LIKE ?`,
      [userId, m+'%']);
    const recurringIncAmt = recurringMonthlyIncome
      .filter(t => (t.date||'').slice(0,7) <= m)
      .reduce((s, t) => s + t.amount, 0);
    const exp = get(`SELECT COALESCE(SUM(amount),0) as s FROM transactions
      WHERE user_id=? AND type='expense' AND recurrence!='monthly' AND date LIKE ?`,
      [userId, m+'%']);
    const recurringAmt = recurringMonthly
      .filter(t => (t.date||'').slice(0,7) <= m)
      .reduce((s, t) => s + t.amount, 0);
    const debtInst = activeDebts
      .filter(dd => debtHasPaymentInMonth(dd, hYear, hMonth))
      .reduce((s, dd) => s + debtInstallmentValue(dd), 0);
    const totalInc = (inc?.s||0) + recurringIncAmt;
    const totalExp = (exp?.s||0) + recurringAmt + debtInst;
    monthly.push({ month: m, income: totalInc, expense: totalExp,
      debtTotal: parseFloat(debtInst.toFixed(2)),
      saldo: totalInc - totalExp });
  }

  const expByCat = all(
    `SELECT category, SUM(amount) as total FROM transactions
     WHERE user_id=? AND type='expense' AND date LIKE ? GROUP BY category ORDER BY total DESC`,
    [userId, month+'%']
  );

  const alerts = [];
  const overdueTx = all(`SELECT * FROM transactions WHERE user_id=? AND type='expense' AND status='pending' AND due_date<? LIMIT 5`, [userId, today()]);
  overdueTx.forEach(t => alerts.push({ type:'danger', msg:`Despesa vencida: ${t.description} (R$ ${t.amount.toFixed(2)})` }));
  if (activeDebts.length) {
    const totalThisMonth = debtSchedule[0]?.total || 0;
    if (totalThisMonth > 0)
      alerts.push({ type:'warning', msg:`${activeDebts.length} dívida(s) ativa(s) — ${fmtCurrency(totalThisMonth)} em parcelas este mês` });
  }
  const goalsDue = all(`SELECT * FROM goals WHERE user_id=? AND status='active' AND deadline<=date('now','+30 days') AND deadline>=date('now')`, [userId]);
  goalsDue.forEach(g => alerts.push({ type:'info', msg:`Meta próxima do prazo: ${g.name}` }));

  res.json({
    balance: totBal,
    monthlyIncome: (mInc?.s||0) + recurringIncomeTotal,
    monthlyExpense: mExpTotal,
    monthlyExpensePaid: mExpPaid?.s||0,
    monthlyDebtTotal: parseFloat(monthlyDebtTotal.toFixed(2)),
    totalDebt: parseFloat(totDebt.toFixed(2)),
    debtSchedule,
    patrimonio, score, monthly, expByCategory: expByCat, recentTransactions: recent,
    accounts: accs.map(a => ({ ...a, balance: accountBalance(a.id) })),
    alerts,
  });
});

function fmtCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(v||0);
}

// ── REPORTS ───────────────────────────────────────────────
app.get('/api/reports', authenticateToken, (req, res) => {
  const from = req.query.from || new Date(new Date().setDate(1)).toISOString().slice(0,10);
  const to   = req.query.to   || today();
  const acct = req.query.account_id;
  const cat  = req.query.category;

  let where = 'WHERE user_id=? AND date>=? AND date<=?';
  const p = [req.userId, from, to];
  if (acct) { where += ' AND account_id=?'; p.push(acct); }
  if (cat)  { where += ' AND category=?';   p.push(cat); }

  const txs   = all(`SELECT * FROM transactions ${where} ORDER BY date`, p);
  const byCat = all(`SELECT category, type, SUM(amount) as total FROM transactions ${where} GROUP BY category,type ORDER BY total DESC`, p);
  const byDay = all(`SELECT date, SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income, SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense FROM transactions ${where} GROUP BY date ORDER BY date`, p);

  res.json({ transactions: txs, byCategory: byCat, byDay });
});

app.get('/api/reports/csv', authenticateToken, (req, res) => {
  const from = req.query.from || new Date(new Date().setDate(1)).toISOString().slice(0,10);
  const to   = req.query.to   || today();
  const txs  = all('SELECT * FROM transactions WHERE user_id=? AND date>=? AND date<=? ORDER BY date', [req.userId, from, to]);
  const header = 'Data,Tipo,Descrição,Valor,Categoria,Status\n';
  const rows   = txs.map(t =>
    `"${t.date}","${t.type==='income'?'Receita':'Despesa'}","${t.description}","${t.amount.toFixed(2)}","${t.category||''}","${t.status}"`
  ).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="relatorio-${from}-${to}.csv"`);
  res.send('﻿' + header + rows);
});

// ── BACKUP / RESTORE ──────────────────────────────────────
app.get('/api/backup', authenticateToken, (req, res) => {
  const u = req.userId;
  const bk = {
    accounts:               all('SELECT * FROM accounts WHERE user_id=?', [u]),
    transactions:           all('SELECT * FROM transactions WHERE user_id=?', [u]),
    debts:                  all('SELECT * FROM debts WHERE user_id=?', [u]),
    debt_payments:          all('SELECT dp.* FROM debt_payments dp JOIN debts d ON d.id=dp.debt_id WHERE d.user_id=?', [u]),
    investments:            all('SELECT * FROM investments WHERE user_id=?', [u]),
    investment_withdrawals: all('SELECT iw.* FROM investment_withdrawals iw JOIN investments i ON i.id=iw.investment_id WHERE i.user_id=?', [u]),
    goals:                  all('SELECT * FROM goals WHERE user_id=?', [u]),
    goal_contributions:     all('SELECT gc.* FROM goal_contributions gc JOIN goals g ON g.id=gc.goal_id WHERE g.user_id=?', [u]),
    credit_cards:           all('SELECT * FROM credit_cards WHERE user_id=?', [u]),
    credit_card_purchases:  all('SELECT cp.* FROM credit_card_purchases cp JOIN credit_cards cc ON cc.id=cp.card_id WHERE cc.user_id=?', [u]),
    budgets:                all('SELECT * FROM budgets WHERE user_id=?', [u]),
    categories:             all('SELECT * FROM categories WHERE custom=1 AND user_id=?', [u]),
  };
  res.setHeader('Content-Disposition', `attachment; filename="backup-${today()}.json"`);
  res.json(bk);
});

app.post('/api/restore', authenticateToken, (req, res) => {
  const bk = req.body;
  const u  = req.userId;
  try {
    const tables = ['accounts','transactions','debts','debt_payments','investments',
      'investment_withdrawals','goals','goal_contributions','credit_cards',
      'credit_card_purchases','budgets'];
    tables.forEach(t => db.run(`DELETE FROM ${t} WHERE ${
      ['debt_payments','investment_withdrawals','goal_contributions','credit_card_purchases'].includes(t) ? '1=1' : 'user_id=?'
    }`, ['debt_payments','investment_withdrawals','goal_contributions','credit_card_purchases'].includes(t) ? [] : [u]));
    tables.forEach(t => {
      (bk[t]||[]).forEach(row => {
        const r = { ...row, user_id: u };
        const cols = Object.keys(r).join(',');
        const vals = Object.keys(r).map(()=>'?').join(',');
        db.run(`INSERT OR IGNORE INTO ${t} (${cols}) VALUES (${vals})`, Object.values(r));
      });
    });
    (bk.categories||[]).forEach(row => {
      const r = { ...row, user_id: u, custom: 1 };
      db.run('INSERT OR IGNORE INTO categories (id,name,type,color,icon,custom,user_id) VALUES (?,?,?,?,?,?,?)',
        [r.id, r.name, r.type, r.color, r.icon, 1, u]);
    });
    save();
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/clear', authenticateToken, (req, res) => {
  const u = req.userId;
  ['accounts','transactions','debts','investments','goals','credit_cards','budgets','transfers'].forEach(t => {
    db.run(`DELETE FROM ${t} WHERE user_id=?`, [u]);
  });
  save();
  res.json({ ok: true });
});

// ── SPA fallback ──────────────────────────────────────────
app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// ── Init ──────────────────────────────────────────────────
initSql().then(SQL => {
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }
  createSchema();
  seedCategories();
  app.listen(PORT, () => {
    console.log(`FinanceiroApp → http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Erro ao inicializar DB:', err);
  process.exit(1);
});
