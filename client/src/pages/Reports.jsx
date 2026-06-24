import React, { useEffect, useState, useCallback } from 'react';
import { Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { api } from '../api';
import { fmtBRL, fmtDate, monthISO } from '../utils';
import { Btn } from '../components/Modal';

const PIE_COLORS = ['#6366f1','#f43f5e','#f59e0b','#10b981','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}
function todayISO() { const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }

export default function Reports() {
  const [data, setData]     = useState(null);
  const [accs, setAccs]     = useState([]);
  const [cats, setCats]     = useState([]);
  const [params, setParams] = useState({ from: firstOfMonth(), to: todayISO(), account_id:'', category:'' });

  const load = useCallback(() => {
    api.reports.data(params).then(setData).catch(console.error);
    api.accounts().then(setAccs);
    api.categories().then(setCats);
  }, [params]);

  useEffect(() => { load(); }, [load]);

  const pset = k => e => setParams(p => ({ ...p, [k]: e.target.value }));

  const totalInc = data?.transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0)||0;
  const totalExp = data?.transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0)||0;

  const incByCat = (data?.byCategory||[]).filter(c=>c.type==='income');
  const expByCat = (data?.byCategory||[]).filter(c=>c.type==='expense');

  const dayData = (data?.byDay||[]).map(d => ({
    name: fmtDate(d.date),
    Receitas: d.income,
    Despesas: d.expense,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">Relatórios</h1>
        <a href={api.reports.csvUrl(params)} download className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
          <Download size={15} />Exportar CSV
        </a>
      </div>

      {/* Filters */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 mb-5 flex flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">De:</label>
          <input type="date" value={params.from} onChange={pset('from')}
            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Até:</label>
          <input type="date" value={params.to} onChange={pset('to')}
            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
        </div>
        <select value={params.account_id} onChange={pset('account_id')}
          className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
          <option value="">Todas as contas</option>
          {accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={params.category} onChange={pset('category')}
          className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
          <option value="">Todas as categorias</option>
          {cats.map(c => <option key={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400 mb-1">Total receitas</div>
          <div className="text-xl font-bold text-emerald-400">{fmtBRL(totalInc)}</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400 mb-1">Total despesas</div>
          <div className="text-xl font-bold text-rose-400">{fmtBRL(totalExp)}</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400 mb-1">Saldo do período</div>
          <div className={`text-xl font-bold ${totalInc-totalExp>=0?'text-indigo-400':'text-rose-400'}`}>{fmtBRL(totalInc-totalExp)}</div>
        </div>
      </div>

      {/* Fluxo diário */}
      {dayData.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-4">
          <div className="text-sm font-medium text-slate-300 mb-3">Fluxo de caixa diário</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" tick={{ fontSize:10, fill:'#94a3b8' }} />
              <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8 }} formatter={v=>fmtBRL(v)} />
              <Bar dataKey="Receitas" fill="#10b981" radius={[2,2,0,0]} />
              <Bar dataKey="Despesas" fill="#f43f5e" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* By category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="text-sm font-medium text-slate-300 mb-3">Despesas por categoria</div>
          {expByCat.length === 0 ? (
            <div className="text-center text-slate-500 py-8 text-sm">Sem dados</div>
          ) : (
            <div className="space-y-2">
              {expByCat.map((c, i) => {
                const pct = totalExp > 0 ? (c.total / totalExp) * 100 : 0;
                return (
                  <div key={c.category}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-300">{c.category||'Outros'}</span>
                      <span className="text-slate-400">{fmtBRL(c.total)} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" style={{ width:`${pct}%`, background: PIE_COLORS[i%PIE_COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="text-sm font-medium text-slate-300 mb-3">Receitas por categoria</div>
          {incByCat.length === 0 ? (
            <div className="text-center text-slate-500 py-8 text-sm">Sem dados</div>
          ) : (
            <div className="space-y-2">
              {incByCat.map((c, i) => {
                const pct = totalInc > 0 ? (c.total / totalInc) * 100 : 0;
                return (
                  <div key={c.category}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-300">{c.category||'Outros'}</span>
                      <span className="text-slate-400">{fmtBRL(c.total)} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-emerald-500" style={{ width:`${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Transaction list */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="text-sm font-medium text-slate-300">Lançamentos do período ({data?.transactions.length||0})</div>
        </div>
        {!data?.transactions.length ? (
          <div className="text-center text-slate-500 py-10 text-sm">Nenhum lançamento no período</div>
        ) : (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-800">
                <tr className="border-b border-slate-700">
                  {['Data','Tipo','Descrição','Categoria','Valor'].map(h=>(
                    <th key={h} className="text-left px-4 py-2 text-xs font-medium text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.transactions.map(t => (
                  <tr key={t.id} className="border-b border-slate-700/40 hover:bg-slate-700/30">
                    <td className="px-4 py-2 text-xs text-slate-400 whitespace-nowrap">{fmtDate(t.date)}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${t.type==='income'?'bg-emerald-500/20 text-emerald-400':'bg-rose-500/20 text-rose-400'}`}>
                        {t.type==='income'?'Receita':'Despesa'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-white">{t.description}</td>
                    <td className="px-4 py-2 text-xs text-slate-400">{t.category}</td>
                    <td className={`px-4 py-2 text-xs font-bold whitespace-nowrap ${t.type==='income'?'text-emerald-400':'text-rose-400'}`}>
                      {t.type==='income'?'+':'−'}{fmtBRL(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
