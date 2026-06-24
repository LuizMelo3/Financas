import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Copy } from 'lucide-react';
import { api } from '../api';
import { fmtBRL, monthISO } from '../utils';
import Modal, { Field, Input, Select, Btn } from '../components/Modal';

export default function Budget() {
  const [budgets, setBudgets] = useState([]);
  const [cats, setCats]       = useState([]);
  const [month, setMonth]     = useState(monthISO());
  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState({ category:'', amount:'' });

  const load = useCallback(() => {
    api.budgets.list(month).then(setBudgets);
    api.categories('expense').then(setCats);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (!form.category || !form.amount) return;
    await api.budgets.save({ ...form, month });
    setModal(false); load();
  }

  async function del(id) {
    await api.budgets.del(id); load();
  }

  async function copyFromPrev() {
    const [y, m] = month.split('-');
    const d = new Date(+y, +m - 2, 1);
    const prevMonth = d.toISOString().slice(0, 7);
    const prev = await api.budgets.list(prevMonth);
    for (const b of prev) {
      await api.budgets.save({ category: b.category, amount: b.amount, month });
    }
    load();
  }

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent  = budgets.reduce((s, b) => s + b.spent, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Orçamento mensal</h1>
          <p className="text-sm text-slate-400">
            Orçado: <span className="text-indigo-400 font-bold">{fmtBRL(totalBudget)}</span>
            {' '}· Gasto: <span className={`font-bold ${totalSpent>totalBudget?'text-rose-400':'text-emerald-400'}`}>{fmtBRL(totalSpent)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={copyFromPrev} title="Copiar orçamento do mês anterior">
            <Copy size={15} className="mr-1.5" />Copiar mês anterior
          </Btn>
          <Btn onClick={() => { setForm({ category:'', amount:'' }); setModal(true); }}>
            <Plus size={15} className="mr-1.5" />Adicionar categoria
          </Btn>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-3 mb-5">
        <label className="text-sm text-slate-400">Mês:</label>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
      </div>

      {/* Summary bar */}
      {totalBudget > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-300 font-medium">Total do orçamento</span>
            <span className={`font-bold ${totalSpent>totalBudget?'text-rose-400':'text-emerald-400'}`}>
              {fmtBRL(totalSpent)} / {fmtBRL(totalBudget)}
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3">
            <div className={`h-3 rounded-full transition-all ${
              totalSpent/totalBudget > 1 ? 'bg-rose-500' :
              totalSpent/totalBudget > 0.8 ? 'bg-amber-500' : 'bg-emerald-500'
            }`} style={{ width: `${Math.min(100, (totalSpent/totalBudget)*100)}%` }} />
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="space-y-3">
        {budgets.map(b => {
          const pct = b.amount > 0 ? (b.spent / b.amount) * 100 : 0;
          const over = pct > 100;
          const warn = pct >= 80 && !over;
          return (
            <div key={b.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-white">{b.category}</div>
                <div className="flex items-center gap-2">
                  {over && <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400">Estourou</span>}
                  {warn && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">+80%</span>}
                  <span className={`text-sm font-bold ${over?'text-rose-400':warn?'text-amber-400':'text-slate-300'}`}>
                    {fmtBRL(b.spent)} / {fmtBRL(b.amount)}
                  </span>
                  <button onClick={() => del(b.id)}
                    className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-rose-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div className={`h-2 rounded-full transition-all ${over?'bg-rose-500':warn?'bg-amber-500':'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
              <div className="text-xs text-slate-500 mt-1">{pct.toFixed(0)}% utilizado</div>
            </div>
          );
        })}
      </div>

      {budgets.length === 0 && (
        <div className="text-center text-slate-500 py-20">
          <div className="text-4xl mb-3">📊</div>
          <p>Nenhuma categoria no orçamento deste mês.<br/>Clique em "Adicionar categoria" para começar.</p>
        </div>
      )}

      {modal && (
        <Modal title="Adicionar ao orçamento" onClose={() => setModal(false)}>
          <Field label="Categoria">
            <Select value={form.category} onChange={set('category')}>
              <option value="">Selecione...</option>
              {cats.map(c => <option key={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Limite do mês (R$)">
            <Input type="number" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0,00" />
          </Field>
          <div className="flex gap-2 justify-end mt-2">
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn onClick={save}>Salvar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
