import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, ArrowDownCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../api';
import { fmtBRL, fmtDate, todayISO } from '../utils';
import Modal, { Field, Input, Select, Btn } from '../components/Modal';

const TYPES = ['Poupança','CDB','LCI/LCA','Tesouro Direto','Fundo de investimento',
  'Ações','FII','Cripto','Previdência Privada','Outros'];
const LIQUIDEZ = ['diaria','no vencimento','outra'];
const LIQ_LABEL = { diaria:'Diária', 'no vencimento':'No vencimento', outra:'Outra' };

const blank = { description:'', type:'CDB', institution:'', amount:'', date:todayISO(),
  monthly_rate:'0', maturity_date:'', liquidity:'diaria', account_id:'' };

export default function Investments() {
  const [invs, setInvs]   = useState([]);
  const [accs, setAccs]   = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm]   = useState(blank);
  const [wdForm, setWd]   = useState({ amount:'', to_account_id:'' });
  const [wdTarget, setWdTarget] = useState(null);

  const load = useCallback(() => {
    api.investments.list().then(setInvs);
    api.accounts().then(setAccs);
  }, []);

  useEffect(() => { load(); }, [load]);

  const set  = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const wset = k => e => setWd(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (!form.description || !form.amount) return;
    await api.investments.create(form);
    setModal(null); load();
  }

  async function withdraw() {
    if (!wdTarget || !wdForm.amount) return;
    await api.investments.withdraw(wdTarget.id, wdForm);
    setModal(null); load();
  }

  async function del(id) {
    if (!confirm('Excluir este investimento?')) return;
    await api.investments.del(id); load();
  }

  const totalInvested = invs.reduce((s, i) => s + i.amount, 0);
  const totalCurrent  = invs.reduce((s, i) => s + i.current_value, 0);
  const totalGain     = totalCurrent - totalInvested;

  // Build evolution data for a selected investment
  function buildEvolution(inv) {
    const pts = [];
    const [iy,im,id2] = inv.date.split('-').map(Number);
    const invStart = new Date(iy, im-1, id2);
    const months = Math.min(12, Math.ceil((Date.now() - invStart.getTime()) / (1000*60*60*24*30.44)));
    for (let i = 0; i <= months; i++) {
      const v = inv.amount * Math.pow(1 + (inv.monthly_rate||0)/100, i);
      const d = new Date(iy, im-1, id2);
      d.setMonth(d.getMonth() + i);
      pts.push({ name: d.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}), valor: +v.toFixed(2) });
    }
    return pts;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Investimentos</h1>
          <p className="text-sm text-slate-400">
            Investido: <span className="text-indigo-400 font-bold">{fmtBRL(totalInvested)}</span>
            {' '}· Atual: <span className="text-emerald-400 font-bold">{fmtBRL(totalCurrent)}</span>
            {' '}· Rendimento: <span className={`font-bold ${totalGain>=0?'text-emerald-400':'text-rose-400'}`}>{totalGain>=0?'+':''}{fmtBRL(totalGain)}</span>
          </p>
        </div>
        <Btn onClick={() => { setForm(blank); setModal('add'); }}>
          <Plus size={15} className="mr-1.5" />Novo investimento
        </Btn>
      </div>

      <div className="space-y-3">
        {invs.map(inv => {
          const gain    = inv.gain;
          const gainPct = inv.gain_pct;
          const positive = gain >= 0;
          const evol = buildEvolution(inv);

          return (
            <div key={inv.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="font-semibold text-white">{inv.description}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{inv.type} · {inv.institution} · {LIQ_LABEL[inv.liquidity]}</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => { setWdTarget(inv); setWd({ amount:'', to_account_id:'' }); setModal('withdraw'); }}
                    className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-colors" title="Resgatar">
                    <ArrowDownCircle size={14} />
                  </button>
                  <button onClick={() => del(inv.id)}
                    className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-3">
                <div>
                  <div className="text-xs text-slate-500">Investido</div>
                  <div className="text-sm font-bold text-white">{fmtBRL(inv.amount)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Valor atual</div>
                  <div className="text-sm font-bold text-emerald-400">{fmtBRL(inv.current_value)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Rendimento</div>
                  <div className={`text-sm font-bold flex items-center gap-1 ${positive?'text-emerald-400':'text-rose-400'}`}>
                    {positive ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                    {positive?'+':''}{fmtBRL(gain)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">% Rentabilidade</div>
                  <div className={`text-sm font-bold ${positive?'text-emerald-400':'text-rose-400'}`}>
                    {positive?'+':''}{gainPct.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span>Aplicado em {fmtDate(inv.date)}</span>
                {inv.monthly_rate > 0 && <span>{inv.monthly_rate}% a.m.</span>}
                {inv.maturity_date && <span>Vence em {fmtDate(inv.maturity_date)}</span>}
              </div>

              {evol.length > 1 && inv.monthly_rate > 0 && (
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={evol}>
                    <XAxis dataKey="name" hide />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, fontSize:12 }}
                      formatter={v => fmtBRL(v)}
                    />
                    <Line type="monotone" dataKey="valor" stroke="#10b981" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          );
        })}
      </div>

      {invs.length === 0 && (
        <div className="text-center text-slate-500 py-20">
          <div className="text-4xl mb-3">📈</div>
          <p>Nenhum investimento cadastrado.</p>
        </div>
      )}

      {modal === 'add' && (
        <Modal title="Novo investimento" onClose={() => setModal(null)}>
          <Field label="Descrição">
            <Input value={form.description} onChange={set('description')} placeholder="Ex: CDB Nubank 100% CDI" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <Select value={form.type} onChange={set('type')}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Instituição">
              <Input value={form.institution} onChange={set('institution')} placeholder="Ex: Nubank" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor aplicado (R$)">
              <Input type="number" step="0.01" value={form.amount} onChange={set('amount')} placeholder="5.000,00" />
            </Field>
            <Field label="Data da aplicação">
              <Input type="date" value={form.date} onChange={set('date')} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rentabilidade % a.m.">
              <Input type="number" step="0.01" value={form.monthly_rate} onChange={set('monthly_rate')} placeholder="0,8" />
            </Field>
            <Field label="Liquidez">
              <Select value={form.liquidity} onChange={set('liquidity')}>
                {LIQUIDEZ.map(l => <option key={l} value={l}>{LIQ_LABEL[l]}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vencimento (opcional)">
              <Input type="date" value={form.maturity_date} onChange={set('maturity_date')} />
            </Field>
            <Field label="Conta de origem">
              <Select value={form.account_id} onChange={set('account_id')}>
                <option value="">Nenhuma</option>
                {accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <Btn variant="ghost" onClick={() => setModal(null)}>Cancelar</Btn>
            <Btn variant="success" onClick={save}>Cadastrar</Btn>
          </div>
        </Modal>
      )}

      {modal === 'withdraw' && wdTarget && (
        <Modal title={`Resgatar — ${wdTarget.description}`} onClose={() => setModal(null)}>
          <div className="bg-slate-700/50 rounded-lg p-3 mb-4 text-sm">
            <div className="text-slate-400">Valor atual disponível:</div>
            <div className="text-emerald-400 font-bold text-lg">{fmtBRL(wdTarget.current_value)}</div>
          </div>
          <Field label="Valor a resgatar (R$)">
            <Input type="number" step="0.01" value={wdForm.amount}
              onChange={wset('amount')} placeholder="0,00" />
          </Field>
          <Field label="Creditar em qual conta">
            <Select value={wdForm.to_account_id} onChange={wset('to_account_id')}>
              <option value="">Nenhuma</option>
              {accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <div className="flex gap-2 justify-end mt-2">
            <Btn variant="ghost" onClick={() => setModal(null)}>Cancelar</Btn>
            <Btn variant="warning" onClick={withdraw}>Resgatar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
