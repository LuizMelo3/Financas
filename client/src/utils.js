export function fmtBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function fmtMonth(m) {
  if (!m) return '';
  const [y, mo] = m.split('-');
  return new Date(+y, +mo - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

function localStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}

export function todayISO() {
  return localStr(new Date());
}

export function monthISO() {
  return localStr(new Date()).slice(0, 7);
}

export function scoreLabel(s) {
  if (s >= 80) return { label: 'Excelente', color: 'text-emerald-400' };
  if (s >= 60) return { label: 'Bom', color: 'text-blue-400' };
  if (s >= 40) return { label: 'Regular', color: 'text-yellow-400' };
  return { label: 'Atenção', color: 'text-rose-400' };
}

export function statusLabel(s) {
  const map = {
    received: { label: 'Recebido', cls: 'bg-emerald-500/20 text-emerald-400' },
    paid:     { label: 'Pago',     cls: 'bg-emerald-500/20 text-emerald-400' },
    pending:  { label: 'Pendente', cls: 'bg-yellow-500/20 text-yellow-400' },
    overdue:  { label: 'Atrasado', cls: 'bg-rose-500/20 text-rose-400' },
  };
  return map[s] || { label: s, cls: 'bg-slate-500/20 text-slate-400' };
}

export function typeColor(type) {
  return type === 'income' ? 'text-emerald-400' : 'text-rose-400';
}

export function typeSign(type) {
  return type === 'income' ? '+' : '−';
}

// Price table installment value
export function priceInstallment(total, n, monthlyRate) {
  if (!monthlyRate || monthlyRate === 0) return total / n;
  const r = monthlyRate / 100;
  return total * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return localStr(d);
}
