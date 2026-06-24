import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, CheckCircle, Calculator } from 'lucide-react';
import { api } from '../api';
import { fmtBRL, fmtDate, todayISO } from '../utils';
import Modal, { Field, Input, Select, Btn } from '../components/Modal';

const CATS = ['Cartão de crédito','Financiamento imóvel','Financiamento veículo',
  'Empréstimo pessoal','Consignado','Consórcio','Outros'];

const blank = { description:'', creditor:'', installment_value:'', installments:'',
  remaining_installments:'', next_date: todayISO(), interest_rate:'0', category:'Outros', account_id:'' };

export default function Debts() {
  const [debts, setDebts] = useState([]);
  const [accs, setAccs]   = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm]   = useState(blank);
  const [sim, setSim]     = useState({ debt: null, extra: '' });

  const load = useCallback(() => {
    api.debts.list().then(setDebts);
    api.accounts().then(setAccs);
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    const instVal   = parseFloat(form.installment_value);
    const n         = parseInt(form.installments);
    const remaining = parseInt(form.remaining_installments) || n;
    const rate      = parseFloat(form.interest_rate) || 0;
    if (!form.description || !instVal || !n || !remaining) return;
    let total_amount;
    if (rate > 0) {
      const r = rate / 100;
      total_amount = instVal * (Math.pow(1+r, n) - 1) / (r * Math.pow(1+r, n));
    } else {
      total_amount = instVal * n;
    }
    await api.debts.create({
      ...form,
      total_amount: parseFloat(total_amount.toFixed(2)),
      installments: n,
      remaining_installments: remaining,
    });
    setModal(null); load();
  }

  async function pay(id) {
    await api.debts.pay(id);
    load();
  }

  async function del(id) {
    if (!confirm('Excluir esta dívida?')) return;
    await api.debts.del(id); load();
  }

  const active = debts.filter(d => d.paid_installments < d.installments);
  const done   = debts.filter(d => d.paid_installments >= d.installments);
  const totalRemaining = active.reduce((s, d) => s + (d.remaining_amount||0), 0);
  const totalMonthly   = active.reduce((s, d) => s + (d.installment_value||0), 0);

  function simResult() {
    if (!sim.debt || !sim.extra) return null;
    const d = sim.debt;
    const extra = parseFloat(sim.extra);
    if (isNaN(extra) || extra <= 0) return null;
    const inst = d.installment_value;
    const rem  = d.installments - d.paid_installments;
    if (!d.interest_rate) {
      const months = Math.ceil(d.remaining_amount / (inst + extra));
      return { months, savings: d.remaining_amount - (inst + extra) * months };
    }
    const r = d.interest_rate / 100;
    let bal = d.remaining_amount;
    let months = 0;
    while (bal > 0 && months < 1000) {
      bal = bal * (1 + r) - (inst + extra);
      months++;
    }
    return { months, savings: inst * rem - (inst + extra) * months };
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Dívidas parceladas</h1>
          <p className="text-sm text-slate-400">
            Restante: <span className="text-rose-400 font-bold">{fmtBRL(totalRemaining)}</span>
            {' '}· Mensal: <span className="text-amber-400 font-bold">{fmtBRL(totalMonthly)}</span>
          </p>
        </div>
        <Btn onClick={() => { setForm(blank); setModal('add'); }}>
          <Plus size={15} className="mr-1.5" />Nova dívida
        </Btn>
      </div>

      {/* Active */}
      <div className="space-y-3 mb-6">
        {active.map(d => {
          const pct = Math.round((d.paid_installments / d.installments) * 100);
          const rem = d.installments - d.paid_installments;
          const quitDate = (() => {
            const [y,m,day] = (d.first_date||'').split('-').map(Number);
            if (!y) return '—';
            const dt = new Date(y, m-1, day); // local, sem bug UTC
            dt.setMonth(dt.getMonth() + d.installments - 1);
            return dt.toLocaleDateString('pt-BR', { month:'long', year:'numeric' });
          })();
          return (
            <div key={d.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="font-semibold text-white">{d.description}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{d.creditor} · {d.category}</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => { setSim({ debt: d, extra: '' }); setModal('sim'); }}
                    className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-indigo-400 transition-colors" title="Simulador">
                    <Calculator size={14} />
                  </button>
                  <button onClick={() => pay(d.id)}
                    className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-colors" title="Pagar parcela">
                    <CheckCircle size={14} />
                  </button>
                  <button onClick={() => del(d.id)}
                    className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <div className="text-xs text-slate-500">Parcela</div>
                  <div className="text-sm font-bold text-white">{fmtBRL(d.installment_value)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Restante</div>
                  <div className="text-sm font-bold text-rose-400">{fmtBRL(d.remaining_amount)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Quitação prevista</div>
                  <div className="text-sm font-bold text-slate-300">{quitDate}</div>
                </div>
              </div>

              <div className="w-full bg-slate-700 rounded-full h-1.5 mb-1">
                <div className="h-1.5 rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>{d.paid_installments}/{d.installments} parcelas · {pct}% quitado</span>
                <span>{rem} restante(s)</span>
              </div>
              {d.next_date && (
                <div className="mt-2 text-xs text-amber-400">Próxima parcela: {fmtDate(d.next_date)}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Done */}
      {done.length > 0 && (
        <>
          <h2 className="text-sm font-medium text-slate-400 mb-3">✅ Quitadas ({done.length})</h2>
          <div className="space-y-2">
            {done.map(d => (
              <div key={d.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-300 font-medium">{d.description}</div>
                  <div className="text-xs text-slate-500">{d.creditor} · {d.installments}x {fmtBRL(d.installment_value)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">Quitada</span>
                  <button onClick={() => del(d.id)} className="p-1.5 rounded hover:bg-slate-700 text-slate-500 hover:text-rose-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {debts.length === 0 && (
        <div className="text-center text-slate-500 py-20">
          <div className="text-4xl mb-3">💳</div>
          <p>Nenhuma dívida cadastrada.</p>
        </div>
      )}

      {/* Add modal */}
      {modal === 'add' && (
        <Modal title="Nova dívida parcelada" onClose={() => setModal(null)}>
          <Field label="Descrição">
            <Input value={form.description} onChange={set('description')} placeholder="Ex: Financiamento notebook" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Credor">
              <Input value={form.creditor} onChange={set('creditor')} placeholder="Ex: Magazine Luiza" />
            </Field>
            <Field label="Categoria">
              <Select value={form.category} onChange={set('category')}>
                {CATS.map(c => <option key={c}>{c}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor da parcela (R$)">
              <Input type="number" step="0.01" value={form.installment_value} onChange={set('installment_value')} placeholder="128,00" />
            </Field>
            <Field label="Nº de parcelas">
              <Input type="number" min="1" value={form.installments} onChange={set('installments')} placeholder="12" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Parcelas restantes">
              <Input type="number" min="1" value={form.remaining_installments}
                onChange={set('remaining_installments')}
                placeholder={form.installments || '...'} />
            </Field>
            <Field label="Data da próxima parcela">
              <Input type="date" value={form.next_date} onChange={set('next_date')} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Juros % a.m. (opcional)">
              <Input type="number" step="0.01" min="0" value={form.interest_rate} onChange={set('interest_rate')} placeholder="0" />
            </Field>
            <Field label="Conta de débito">
              <Select value={form.account_id} onChange={set('account_id')}>
                <option value="">Nenhuma</option>
                {accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
          </div>
          {form.installment_value && form.installments && (
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 text-xs text-slate-300 mt-1">
              {(() => {
                const inst = parseFloat(form.installment_value)||0;
                const n    = parseInt(form.installments)||1;
                const rem  = parseInt(form.remaining_installments) || n;
                const paid = Math.max(0, n - rem);
                const rate = parseFloat(form.interest_rate)||0;
                const totalAmt = rate > 0
                  ? inst * (Math.pow(1+rate/100,n)-1) / ((rate/100) * Math.pow(1+rate/100,n))
                  : inst * n;
                return (<>
                  <div>Parcela mensal: <strong className="text-white">{fmtBRL(inst)}</strong></div>
                  <div className="mt-0.5">Total da dívida: <strong className="text-white">{fmtBRL(totalAmt)}</strong></div>
                  <div className="mt-0.5">Já pago: <strong className="text-emerald-400">{paid}x</strong> · Faltam: <strong className="text-rose-400">{rem}x ({fmtBRL(inst * rem)})</strong></div>
                </>);
              })()}
            </div>
          )}
          <div className="flex gap-2 justify-end mt-3">
            <Btn variant="ghost" onClick={() => setModal(null)}>Cancelar</Btn>
            <Btn variant="danger" onClick={save}>Cadastrar dívida</Btn>
          </div>
        </Modal>
      )}

      {/* Simulator modal */}
      {modal === 'sim' && sim.debt && (
        <Modal title="Simulador de antecipação" onClose={() => setModal(null)}>
          <div className="bg-slate-700/50 rounded-lg p-3 mb-4 text-sm">
            <div className="font-medium text-white mb-1">{sim.debt.description}</div>
            <div className="text-slate-400">
              {sim.debt.installments - sim.debt.paid_installments} parcelas restantes de {fmtBRL(sim.debt.installment_value)}
            </div>
            <div className="text-rose-400 font-bold mt-1">Total restante: {fmtBRL(sim.debt.remaining_amount)}</div>
          </div>
          <Field label="Valor extra por mês (R$)">
            <Input type="number" step="0.01" value={sim.extra}
              onChange={e => setSim(s => ({ ...s, extra: e.target.value }))}
              placeholder="Ex: 200,00" />
          </Field>
          {(() => {
            const r = simResult();
            if (!r) return null;
            return (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-sm">
                <div className="text-emerald-400 font-semibold mb-1">Resultado:</div>
                <div className="text-slate-300">Quitaria em <strong className="text-white">{r.months} meses</strong></div>
                {r.savings > 0 && <div className="text-slate-300 mt-0.5">Economia de <strong className="text-emerald-400">{fmtBRL(r.savings)}</strong> em juros</div>}
              </div>
            );
          })()}
          <div className="flex justify-end mt-3">
            <Btn variant="ghost" onClick={() => setModal(null)}>Fechar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
