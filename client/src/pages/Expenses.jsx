import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Search, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../api';
import { fmtBRL, fmtDate, todayISO, statusLabel } from '../utils';
import Modal, { Field, Input, Select, Textarea, Btn } from '../components/Modal';

const REC_LABELS = { once:'Única (pontual)', monthly:'Fixa mensal (até excluir)' };

const blank = { description:'', amount:'', date:todayISO(), due_date:'', category:'',
  account_id:'', status:'paid', recurrence:'once', notes:'' };

export default function Expenses() {
  const [items, setItems]   = useState([]);
  const [cats, setCats]     = useState([]);
  const [accs, setAccs]     = useState([]);
  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState(blank);
  const [filter, setFilter] = useState({ q:'', from:'', to:'', status:'', category:'' });

  const load = useCallback(() => {
    api.transactions.list({ type: 'expense' }).then(data => {
      // Mark as overdue if past due and still pending
      const today = todayISO();
      setItems(data.map(t => ({
        ...t,
        status: t.status === 'pending' && t.due_date && t.due_date < today ? 'overdue' : t.status,
      })));
    });
    api.categories('expense').then(setCats);
    api.accounts().then(setAccs);
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (!form.description || !form.amount) return;
    await api.transactions.create({ ...form, type: 'expense' });
    setModal(false); load();
  }

  async function del(id) {
    if (!confirm('Excluir esta despesa?')) return;
    await api.transactions.del(id); load();
  }

  async function pay(id) {
    await api.transactions.pay(id); load();
  }

  const filtered = items.filter(t => {
    const q = filter.q.toLowerCase();
    if (q && !t.description.toLowerCase().includes(q) && !(t.category||'').toLowerCase().includes(q)) return false;
    if (filter.from && t.date < filter.from) return false;
    if (filter.to   && t.date > filter.to)   return false;
    if (filter.status && t.status !== filter.status) return false;
    if (filter.category && t.category !== filter.category) return false;
    return true;
  });

  const totalPaid    = filtered.filter(t => t.status === 'paid').reduce((s,t) => s+t.amount, 0);
  const totalPending = filtered.filter(t => t.status !== 'paid').reduce((s,t) => s+t.amount, 0);
  const fset = k => e => setFilter(f => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Despesas</h1>
          <p className="text-sm text-slate-400">
            Pago: <span className="text-rose-400 font-bold">{fmtBRL(totalPaid)}</span>
            {' '} · Pendente: <span className="text-amber-400 font-bold">{fmtBRL(totalPending)}</span>
          </p>
        </div>
        <Btn onClick={() => { setForm(blank); setModal(true); }}>
          <Plus size={15} className="mr-1.5" />Nova despesa
        </Btn>
      </div>

      {/* Filters */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
          <input className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            placeholder="Buscar..." value={filter.q} onChange={fset('q')} />
        </div>
        <input type="date" value={filter.from} onChange={fset('from')}
          className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
        <input type="date" value={filter.to} onChange={fset('to')}
          className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
        <select value={filter.status} onChange={fset('status')}
          className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
          <option value="">Todos status</option>
          <option value="paid">Pago</option>
          <option value="pending">Pendente</option>
          <option value="overdue">Atrasado</option>
        </select>
        <select value={filter.category} onChange={fset('category')}
          className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
          <option value="">Todas categorias</option>
          {cats.map(c => <option key={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center text-slate-500 py-16"><div className="text-3xl mb-2">📤</div>Nenhuma despesa encontrada</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  {['Descrição','Vencimento','Categoria','Conta','Status','Valor',''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const st  = statusLabel(t.status);
                  const acc = accs.find(a => a.id === t.account_id);
                  const isOverdue = t.status === 'overdue';
                  return (
                    <tr key={t.id} className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${isOverdue?'bg-rose-500/5':''}`}>
                      <td className="px-4 py-3 text-sm text-white">
                        {isOverdue && <AlertCircle size={13} className="inline text-rose-400 mr-1.5 -mt-0.5" />}
                        {t.recurrence === 'monthly' && (
                          <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 mr-1.5">🔁 Fixa</span>
                        )}
                        {t.description}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">{fmtDate(t.due_date||t.date)}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{t.category}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{acc?.name||'—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-rose-400 whitespace-nowrap">−{fmtBRL(t.amount)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {t.status !== 'paid' && (
                            <button onClick={() => pay(t.id)} title="Marcar como pago"
                              className="p-1.5 rounded hover:bg-slate-700 text-slate-500 hover:text-emerald-400 transition-colors">
                              <CheckCircle size={13} />
                            </button>
                          )}
                          <button onClick={() => del(t.id)}
                            className="p-1.5 rounded hover:bg-slate-700 text-slate-500 hover:text-rose-400 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <Modal title="Nova despesa" onClose={() => setModal(false)}>
          <Field label="Descrição">
            <Input value={form.description} onChange={set('description')} placeholder="Ex: Conta de luz" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$)">
              <Input type="number" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0,00" />
            </Field>
            <Field label="Data pagamento">
              <Input type="date" value={form.date} onChange={set('date')} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vencimento">
              <Input type="date" value={form.due_date} onChange={set('due_date')} />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={set('status')}>
                <option value="paid">Pago</option>
                <option value="pending">Pendente</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <Select value={form.category} onChange={set('category')}>
                <option value="">Selecione...</option>
                {cats.map(c => <option key={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Conta de débito">
              <Select value={form.account_id} onChange={set('account_id')}>
                <option value="">Nenhuma</option>
                {accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Frequência">
            <Select value={form.recurrence} onChange={set('recurrence')}>
              {Object.entries(REC_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          {form.recurrence === 'monthly' && (
            <div className="bg-sky-500/10 border border-sky-500/20 rounded-lg p-3 text-xs text-slate-300">
              🔁 Esta despesa será contada <strong className="text-white">todo mês</strong> no dashboard e no cronograma até você excluí-la.
            </div>
          )}
          <Field label="Observações">
            <Textarea value={form.notes} onChange={set('notes')} placeholder="Opcional" />
          </Field>
          <div className="flex gap-2 justify-end mt-2">
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn variant="danger" onClick={save}>Salvar despesa</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
