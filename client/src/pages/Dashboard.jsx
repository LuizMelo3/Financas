import React, { useEffect, useState } from 'react';
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ReferenceLine,
} from 'recharts';
import { AlertTriangle, Info, TrendingUp, TrendingDown, Wallet, CreditCard, X } from 'lucide-react';
import { api } from '../api';
import { fmtBRL, fmtDate, fmtMonth, scoreLabel, statusLabel, typeSign } from '../utils';

const PIE_COLORS = ['#6366f1','#f43f5e','#f59e0b','#10b981','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

function Card({ children, className='' }) {
  return <div className={`bg-slate-800 border border-slate-700 rounded-xl p-4 ${className}`}>{children}</div>;
}

function KPICard({ label, value, sub, icon: Icon, color }) {
  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${color}`}><Icon size={18} className="text-white" /></div>
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </Card>
  );
}

function ComparativoCard({ income, expense, debtTotal, label, topLabel = 'Receitas' }) {
  const n = v => (isNaN(v) || !isFinite(v) ? 0 : v);
  const inc  = n(income);
  const exp  = n(expense);
  const debt = n(debtTotal);
  const expensePure = Math.max(0, exp - debt);
  const sobra       = inc - exp;
  const ref         = inc > 0 ? inc : Math.max(exp, 1);

  return (
    <Card>
      <div className="text-sm font-medium text-slate-300 mb-4">
        Comparativo — <span className="text-slate-400 font-normal">{label}</span>
      </div>
      <div className="space-y-3">
        <Row label={topLabel}  pct={100}                     color="bg-emerald-500" value={`+${fmtBRL(inc)}`}           cls="text-emerald-400" />
        <Row label="Despesas"  pct={(expensePure/ref)*100}   color="bg-rose-500"    value={`−${fmtBRL(expensePure)}`}  cls="text-rose-400" />
        {debt > 0 && (
          <Row label="Parcelas" pct={(debt/ref)*100}          color="bg-amber-500"   value={`−${fmtBRL(debt)}`}         cls="text-amber-400" />
        )}
        <div className="border-t border-slate-700 pt-3">
          <Row label="= Sobra"
            pct={sobra >= 0 ? (sobra/ref)*100 : 100}
            color={sobra >= 0 ? 'bg-indigo-500' : 'bg-rose-700'}
            value={`${sobra>=0?'+':''}${fmtBRL(sobra)}`}
            cls={sobra >= 0 ? 'text-indigo-400' : 'text-rose-400'}
            bold
          />
        </div>
      </div>
    </Card>
  );
}

function Row({ label, pct, color, value, cls, bold }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-24 text-xs text-right shrink-0 ${bold ? 'font-semibold text-slate-200' : 'text-slate-400'}`}>{label}</div>
      <div className="flex-1 bg-slate-700 rounded-full h-4 overflow-hidden">
        <div className={`h-4 rounded-full transition-all ${color}`} style={{ width:`${Math.min(100, Math.max(0, pct||0))}%` }} />
      </div>
      <div className={`w-28 text-sm font-bold shrink-0 text-right ${cls}`}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [viewMonth, setViewMonth] = useState(null); // 'YYYY-MM' | null

  useEffect(() => {
    api.dashboard().then(d => { setData(d); setLoading(false); }).catch(console.error);
  }, []);

  if (loading) return <div className="text-slate-400 p-8 text-center">Carregando...</div>;
  if (!data)   return <div className="text-rose-400 p-8 text-center">Erro ao carregar dados.</div>;

  const { balance, monthlyIncome, monthlyExpense, monthlyDebtTotal, totalDebt,
          debtSchedule, score, monthly, expByCategory, recentTransactions, accounts, alerts } = data;
  const sl = scoreLabel(score);

  // Dados do mês selecionado
  const viewMonthData     = viewMonth ? (monthly||[]).find(m => m.month === viewMonth) : null;
  const viewScheduleData  = viewMonth ? (debtSchedule||[]).find(m => m.month === viewMonth) : null;

  const schedDebtTotal = viewScheduleData
    ? viewScheduleData.debts.reduce((s, d) => s + d.value, 0)
    : 0;

  const dispIncome    = viewMonthData    ? viewMonthData.income    : monthlyIncome;
  const dispExpense   = viewScheduleData ? viewScheduleData.total
                      : viewMonthData    ? viewMonthData.expense
                      :                   monthlyExpense;
  const dispDebtTotal = viewScheduleData ? schedDebtTotal
                      : viewMonthData    ? viewMonthData.debtTotal
                      :                   monthlyDebtTotal;

  // Saldo projetado: saldo atual + receitas do mês selecionado − despesas do mês selecionado
  const projectedBalance = viewMonthData ? balance + viewMonthData.saldo : balance;
  const dispBalance      = viewMonthData ? projectedBalance : balance;

  // Referência do comparativo: quando há mês selecionado, usa saldo atual + receita (total disponível)
  // Quando é o mês corrente, usa só a receita do mês
  const compIncome   = viewMonthData ? balance + dispIncome : dispIncome;
  const compTopLabel = viewMonthData ? 'Saldo + Receitas' : 'Receitas';

  const viewMonthLabel = (() => {
    if (!viewMonth) return new Date().toLocaleDateString('pt-BR', { month:'long', year:'numeric' });
    const [y, m] = viewMonth.split('-').map(Number);
    return new Date(y, m-1, 1).toLocaleDateString('pt-BR', { month:'long', year:'numeric' });
  })();

  const currentYear = new Date().getFullYear();

  const monthlyChartData = (monthly||[]).map(m => ({
    name:     fmtMonth(m.month),
    monthKey: m.month,
    Receitas: m.income,
    Despesas: m.expense,
    Saldo:    m.saldo,
  }));

  const currentExpByCategory = viewMonthData?.expByCategory || expByCategory;
  const pieData = (currentExpByCategory||[]).slice(0,8).map(c => ({ name: c.category||'Outros', value: c.total }));

  // Itens do mês selecionado no schedule
  const viewAllItems = viewScheduleData ? [
    ...(viewScheduleData.debts||[]).map(d => ({ ...d, kind:'debt' })),
    ...(viewScheduleData.expenses||[]).map(e => ({ ...e, kind: e.kind||'expense' })),
  ] : [];

  return (
    <div className="space-y-5">
      {/* Alerts */}
      {alerts?.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm border ${
              a.type==='danger'  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' :
              a.type==='warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' :
                                   'bg-blue-500/10 border-blue-500/30 text-blue-300'
            }`}>
              {a.type==='info' ? <Info size={15}/> : <AlertTriangle size={15}/>}
              {a.msg}
            </div>
          ))}
        </div>
      )}

      {/* Banner mês selecionado */}
      {viewMonth && (
        <div className="flex items-center justify-between bg-indigo-500/20 border border-indigo-500/40 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-indigo-300">
            <span>📅</span>
            <span>Visualizando <strong className="text-indigo-200">{viewMonthLabel}</strong> — dados projetados com base em receitas e despesas fixas</span>
          </div>
          <button onClick={() => setViewMonth(null)}
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-white transition-colors">
            <X size={13} /> Voltar ao mês atual
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label={viewMonth ? `Saldo projetado — ${viewMonthLabel}` : 'Saldo total'}
          value={fmtBRL(dispBalance)}
          icon={Wallet}
          color={dispBalance >= 0 ? 'bg-emerald-600' : 'bg-rose-600'}
          sub={viewMonth
            ? `Atual ${fmtBRL(balance)} + receitas − despesas/dívidas`
            : `${accounts?.length||0} conta(s)`} />
        <KPICard
          label={viewMonth ? `Receitas — ${viewMonthLabel}` : 'Receitas do mês'}
          value={fmtBRL(dispIncome)} icon={TrendingUp} color="bg-indigo-600"
          sub={viewMonth && dispIncome > 0 ? `+${fmtBRL(dispIncome)} ao saldo` : undefined} />
        <KPICard
          label={viewMonth ? `Despesas — ${viewMonthLabel}` : 'Despesas do mês'}
          value={fmtBRL(dispExpense)} icon={TrendingDown} color="bg-rose-600"
          sub={dispDebtTotal > 0 ? `Inclui ${fmtBRL(dispDebtTotal)} em parcelas` : undefined} />
        <KPICard label="Total em dívidas" value={fmtBRL(totalDebt)} icon={CreditCard}
          color="bg-amber-600"
          sub={`${fmtBRL(monthlyDebtTotal)}/mês em parcelas`} />
      </div>

      {/* Score */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-slate-300">Score de saúde financeira</div>
          <span className={`text-sm font-bold ${sl.color}`}>{sl.label}</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2.5">
          <div className={`h-2.5 rounded-full transition-all ${score>=80?'bg-emerald-500':score>=60?'bg-blue-500':score>=40?'bg-amber-500':'bg-rose-500'}`}
            style={{ width:`${score}%` }} />
        </div>
        <div className="text-right text-xs text-slate-400 mt-1">{score}/100</div>
      </Card>

      {/* Comparativo */}
      <ComparativoCard
        income={compIncome}
        expense={dispExpense}
        debtTotal={dispDebtTotal}
        label={viewMonthLabel}
        topLabel={compTopLabel}
      />

      {/* Detail do mês selecionado (se estiver no schedule) */}
      {viewMonth && viewScheduleData && viewAllItems.length > 0 && (
        <Card>
          <div className="text-sm font-medium text-slate-300 mb-3">
            📋 Compromissos de <strong className="text-white">{viewMonthLabel}</strong>
          </div>
          <div className="space-y-1.5">
            {viewAllItems.map((item, j) => (
              <div key={j} className="flex items-center justify-between py-1.5 border-b border-slate-700/40 last:border-0">
                <div className="flex items-center gap-2 text-sm">
                  <span>{item.kind==='debt' ? '💳' : item.kind==='fixed' ? '🔁' : '📌'}</span>
                  <span className="text-slate-200">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-rose-400">−{fmtBRL(item.value)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 text-sm font-bold">
              <span className="text-slate-300">Total de compromissos</span>
              <span className="text-rose-400">−{fmtBRL(viewScheduleData.total)}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="text-sm font-medium text-slate-300 mb-3">
            Receitas × Despesas × Saldo — {currentYear}
            {viewMonth && <span className="ml-2 text-xs text-indigo-400 font-normal">● mês selecionado</span>}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={monthlyChartData} margin={{ top:0, right:0, bottom:0, left:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" tick={{ fontSize:11, fill:'#94a3b8' }} />
              <YAxis tick={{ fontSize:11, fill:'#94a3b8' }} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8 }}
                formatter={v => fmtBRL(v)}
              />
              <Legend />
              {viewMonth && (
                <ReferenceLine x={fmtMonth(viewMonth)} stroke="#6366f1" strokeWidth={2} strokeDasharray="4 2" />
              )}
              <Bar dataKey="Receitas" fill="#10b981" radius={[3,3,0,0]} />
              <Bar dataKey="Despesas" fill="#f43f5e" radius={[3,3,0,0]} />
              <Line type="monotone" dataKey="Saldo" stroke="#6366f1" strokeWidth={2} dot={{ fill:'#6366f1', r:3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <div className="text-sm font-medium text-slate-300 mb-3">
            Despesas por categoria
            {viewMonth && <span className="ml-1 text-xs text-indigo-400 font-normal">— {viewMonthLabel}</span>}
          </div>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" outerRadius={65} innerRadius={35}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8 }} formatter={v => fmtBRL(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-1">
                {pieData.slice(0,5).map((d,i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i%PIE_COLORS.length] }} />
                      <span className="text-slate-300 truncate max-w-[100px]">{d.name}</span>
                    </div>
                    <span className="text-slate-400">{fmtBRL(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center text-slate-500 py-8 text-sm">Sem despesas este mês</div>
          )}
        </Card>
      </div>

      {/* Monthly schedule — clicável */}
      {debtSchedule && debtSchedule.some(m => m.total > 0) && (
        <Card>
          <div className="text-sm font-medium text-slate-300 mb-3">
            📅 Compromissos mensais — próximos 6 meses
            <span className="ml-2 text-xs text-slate-500 font-normal">Clique em um mês para detalhar</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {debtSchedule.map((m, i) => {
              const [y, mo] = m.month.split('-');
              const label = new Date(+y, +mo-1, 1).toLocaleDateString('pt-BR', { month:'short', year:'2-digit' });
              const isSelected = viewMonth === m.month;
              const isCurrent  = i === 0 && !viewMonth;
              const allItems = [
                ...(m.debts||[]).map(d => ({ ...d, kind:'debt' })),
                ...(m.expenses||[]).map(e => ({ ...e, kind: e.kind||'expense' })),
              ];
              return (
                <div
                  key={m.month}
                  onClick={() => setViewMonth(isSelected ? null : m.month)}
                  className={`rounded-lg p-2.5 cursor-pointer transition-all select-none ${
                    isSelected
                      ? 'bg-indigo-600/50 border-2 border-indigo-400 ring-1 ring-indigo-400/50'
                      : isCurrent
                        ? 'bg-indigo-600/30 border border-indigo-500/50 hover:bg-indigo-600/40'
                        : 'bg-slate-700/50 border border-transparent hover:bg-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className={`text-xs mb-1 font-semibold ${isSelected ? 'text-indigo-200' : isCurrent ? 'text-indigo-300' : 'text-slate-400'}`}>
                    {label}{isCurrent ? ' (atual)' : ''}{isSelected ? ' ✓' : ''}
                  </div>
                  <div className={`text-sm font-bold mb-1.5 ${m.total > 0 ? (isSelected || isCurrent ? 'text-indigo-300' : 'text-rose-400') : 'text-slate-600'}`}>
                    {m.total > 0 ? fmtBRL(m.total) : '—'}
                  </div>
                  {allItems.length > 0 && (
                    <div className="space-y-0.5">
                      {allItems.slice(0, 4).map((item, j) => (
                        <div key={j} className="flex items-center gap-1 text-xs truncate" title={item.name}>
                          <span>{item.kind==='debt' ? '💳' : item.kind==='fixed' ? '🔁' : '📌'}</span>
                          <span className="text-slate-500 truncate flex-1">{item.name}</span>
                          <span className="text-slate-400 flex-shrink-0">{fmtBRL(item.value)}</span>
                        </div>
                      ))}
                      {allItems.length > 4 && (
                        <div className="text-xs text-slate-600">+{allItems.length - 4} mais</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Accounts + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="text-sm font-medium text-slate-300 mb-3">Contas</div>
          {accounts?.length === 0 ? (
            <div className="text-slate-500 text-sm text-center py-4">Nenhuma conta cadastrada</div>
          ) : (
            <div className="space-y-2">
              {accounts?.map(a => (
                <div key={a.id} className="flex items-center justify-between p-2.5 bg-slate-700/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: a.color }} />
                    <div>
                      <div className="text-sm text-white font-medium">{a.name}</div>
                      <div className="text-xs text-slate-400">{a.bank} · {a.type}</div>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${a.balance>=0?'text-emerald-400':'text-rose-400'}`}>{fmtBRL(a.balance)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="text-sm font-medium text-slate-300 mb-3">Últimos lançamentos</div>
          {recentTransactions?.length === 0 ? (
            <div className="text-slate-500 text-sm text-center py-4">Nenhum lançamento</div>
          ) : (
            <div className="space-y-2">
              {recentTransactions?.map(t => {
                const st = statusLabel(t.status);
                return (
                  <div key={t.id} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{t.description}</div>
                      <div className="text-xs text-slate-400">{fmtDate(t.date)} · {t.category}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      <span className={`text-sm font-bold ${t.type==='income'?'text-emerald-400':'text-rose-400'}`}>
                        {typeSign(t.type)}{fmtBRL(t.amount)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
