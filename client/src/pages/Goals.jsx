import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, PlusCircle } from 'lucide-react';
import { api } from '../api';
import { fmtBRL, fmtDate, todayISO } from '../utils';
import Modal, { Field, Input, Select, Textarea, Btn } from '../components/Modal';

const CATS   = ['Reserva de emergência','Viagem','Compra de imóvel','Compra de veículo','Educação','Aposentadoria','Outros'];
const ICONS  = ['🎯','🏠','🚗','✈️','📚','🏦','💰','🎓','🏖️','💍'];
const COLORS = ['#6366f1','#10b981','#f43f5e','#f59e0b','#8b5cf6','#06b6d4','#ec4899'];
const STATUS_LABELS = { active:'Em andamento', completed:'Concluída', paused:'Pausada', cancelled:'Cancelada' };
const STATUS_COLORS = { active:'text-indigo-400', completed:'text-emerald-400', paused:'text-amber-400', cancelled:'text-rose-400' };

const blank = { name:'', description:'', target_amount:'', deadline:'', category:'Outros', color:'#6366f1', icon:'🎯' };
const blankC = { amount:'', notes:'' };

export default function Goals() {
  const [goals, setGoals]   = useState([]);
  const [modal, setModal]   = useState(null);
  const [form, setForm]     = useState(blank);
  const [cform, setCform]   = useState(blankC);
  const [cTarget, setCTarget] = useState(null);

  const load = useCallback(() => { api.goals.list().then(setGoals); }, []);
  useEffect(() => { load(); }, [load]);

  const set  = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const cset = k => e => setCform(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (!form.name || !form.target_amount) return;
    await api.goals.create(form);
    setModal(null); load();
  }

  async function contribute() {
    if (!cTarget || !cform.amount) return;
    await api.goals.contribute(cTarget.id, cform);
    setModal(null); load();
  }

  async function setStatus(id, status) {
    const g = goals.find(x => x.id === id);
    if (g) await api.goals.update(id, { ...g, status });
    load();
  }

  async function del(id) {
    if (!confirm('Excluir esta meta?')) return;
    await api.goals.del(id); load();
  }

  function monthsNeeded(g) {
    const remaining = g.target_amount - g.current_amount;
    if (remaining <= 0) return 0;
    if (!g.deadline) return null;
    const [dy,dm,dd]=g.deadline.split('-').map(Number);
    const months = Math.ceil((new Date(dy,dm-1,dd) - new Date()) / (1000*60*60*24*30.44));
    return months > 0 ? months : 0;
  }

  const active    = goals.filter(g => g.status === 'active');
  const completed = goals.filter(g => g.status === 'completed');
  const others    = goals.filter(g => g.status !== 'active' && g.status !== 'completed');

  function GoalCard({ g }) {
    const pct    = g.pct;
    const months = monthsNeeded(g);
    const monthlyNeeded = months && months > 0 ? (g.target_amount - g.current_amount) / months : null;

    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{g.icon}</span>
            <div>
              <div className="font-semibold text-white">{g.name}</div>
              <div className="text-xs text-slate-400">{g.category}</div>
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {g.status === 'active' && (
              <button onClick={() => { setCTarget(g); setCform(blankC); setModal('contribute'); }}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-colors" title="Aportar">
                <PlusCircle size={14} />
              </button>
            )}
            <button onClick={() => del(g.id)}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="flex items-end justify-between mb-1">
          <div>
            <div className="text-xs text-slate-500">Acumulado</div>
            <div className="text-lg font-bold" style={{ color: g.color }}>{fmtBRL(g.current_amount)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Meta</div>
            <div className="text-sm font-bold text-white">{fmtBRL(g.target_amount)}</div>
          </div>
        </div>

        <div className="w-full bg-slate-700 rounded-full h-2 mb-1">
          <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: g.color }} />
        </div>

        <div className="flex justify-between text-xs text-slate-500 mb-2">
          <span>{pct.toFixed(1)}% concluído</span>
          <span>Faltam {fmtBRL(Math.max(0, g.target_amount - g.current_amount))}</span>
        </div>

        {g.description && <div className="text-xs text-slate-400 mb-2">{g.description}</div>}

        <div className="flex items-center justify-between text-xs">
          {g.deadline && (
            <span className="text-slate-500">Prazo: {fmtDate(g.deadline)}</span>
          )}
          {monthlyNeeded && g.status === 'active' && (
            <span className="text-indigo-400">Poupar {fmtBRL(monthlyNeeded)}/mês</span>
          )}
          <span className={STATUS_COLORS[g.status]}>{STATUS_LABELS[g.status]}</span>
        </div>

        {g.status === 'active' && (
          <div className="flex gap-2 mt-3">
            <button onClick={() => setStatus(g.id,'paused')}
              className="text-xs text-amber-400 hover:text-amber-300 transition-colors">Pausar</button>
            <button onClick={() => setStatus(g.id,'cancelled')}
              className="text-xs text-rose-400 hover:text-rose-300 transition-colors">Cancelar</button>
          </div>
        )}
        {(g.status === 'paused' || g.status === 'cancelled') && (
          <button onClick={() => setStatus(g.id,'active')}
            className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Reativar</button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Metas financeiras</h1>
          <p className="text-sm text-slate-400">{active.length} ativa(s) · {completed.length} concluída(s)</p>
        </div>
        <Btn onClick={() => { setForm(blank); setModal('add'); }}>
          <Plus size={15} className="mr-1.5" />Nova meta
        </Btn>
      </div>

      {active.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {active.map(g => <GoalCard key={g.id} g={g} />)}
        </div>
      )}

      {completed.length > 0 && (
        <>
          <h2 className="text-sm font-medium text-slate-400 mb-3">✅ Concluídas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {completed.map(g => <GoalCard key={g.id} g={g} />)}
          </div>
        </>
      )}

      {others.length > 0 && (
        <>
          <h2 className="text-sm font-medium text-slate-400 mb-3">Pausadas / Canceladas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {others.map(g => <GoalCard key={g.id} g={g} />)}
          </div>
        </>
      )}

      {goals.length === 0 && (
        <div className="text-center text-slate-500 py-20">
          <div className="text-4xl mb-3">🎯</div>
          <p>Nenhuma meta cadastrada.</p>
        </div>
      )}

      {modal === 'add' && (
        <Modal title="Nova meta" onClose={() => setModal(null)}>
          <Field label="Nome da meta">
            <Input value={form.name} onChange={set('name')} placeholder="Ex: Reserva de emergência" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor alvo (R$)">
              <Input type="number" step="0.01" value={form.target_amount} onChange={set('target_amount')} placeholder="18.000,00" />
            </Field>
            <Field label="Prazo">
              <Input type="date" value={form.deadline} onChange={set('deadline')} />
            </Field>
          </div>
          <Field label="Categoria">
            <Select value={form.category} onChange={set('category')}>
              {CATS.map(c => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Descrição">
            <Textarea value={form.description} onChange={set('description')} placeholder="Opcional" rows={2} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ícone">
              <div className="flex flex-wrap gap-1">
                {ICONS.map(i => (
                  <button key={i} onClick={() => setForm(f=>({...f,icon:i}))}
                    className={`text-xl p-1 rounded ${form.icon===i?'bg-slate-600':''}`}>{i}</button>
                ))}
              </div>
            </Field>
            <Field label="Cor">
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f=>({...f,color:c}))}
                    className={`w-6 h-6 rounded-full transition-transform ${form.color===c?'ring-2 ring-white scale-110':''}`}
                    style={{ background: c }} />
                ))}
              </div>
            </Field>
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <Btn variant="ghost" onClick={() => setModal(null)}>Cancelar</Btn>
            <Btn onClick={save}>Criar meta</Btn>
          </div>
        </Modal>
      )}

      {modal === 'contribute' && cTarget && (
        <Modal title={`Aporte — ${cTarget.name}`} onClose={() => setModal(null)}>
          <div className="bg-slate-700/50 rounded-lg p-3 mb-4">
            <div className="text-sm text-slate-300">Progresso atual:</div>
            <div className="flex justify-between mt-1">
              <span className="font-bold" style={{ color: cTarget.color }}>{fmtBRL(cTarget.current_amount)}</span>
              <span className="text-slate-400">de {fmtBRL(cTarget.target_amount)}</span>
            </div>
            <div className="w-full bg-slate-600 rounded-full h-1.5 mt-2">
              <div className="h-1.5 rounded-full" style={{ width:`${cTarget.pct}%`, background: cTarget.color }} />
            </div>
          </div>
          <Field label="Valor do aporte (R$)">
            <Input type="number" step="0.01" value={cform.amount} onChange={cset('amount')} placeholder="0,00" />
          </Field>
          <Field label="Observações">
            <Input value={cform.notes} onChange={cset('notes')} placeholder="Opcional" />
          </Field>
          <div className="flex gap-2 justify-end mt-2">
            <Btn variant="ghost" onClick={() => setModal(null)}>Cancelar</Btn>
            <Btn variant="success" onClick={contribute}>Registrar aporte</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
