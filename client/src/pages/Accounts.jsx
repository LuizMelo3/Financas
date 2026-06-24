import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ArrowLeftRight } from 'lucide-react';
import { api } from '../api';
import { fmtBRL, fmtDate, todayISO } from '../utils';
import Modal, { Field, Input, Select, Btn } from '../components/Modal';

const TYPES    = ['corrente','poupança','investimento','carteira'];
const COLORS   = ['#6366f1','#10b981','#f43f5e','#f59e0b','#8b5cf6','#06b6d4','#ec4899'];

const blank  = { name:'', bank:'', type:'corrente', initial_balance:'', color:'#6366f1' };
const blankT = { from_account_id:'', to_account_id:'', amount:'', date:todayISO(), notes:'' };

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [modal, setModal]     = useState(null); // 'add'|'edit'|'transfer'|'history'
  const [form, setForm]       = useState(blank);
  const [tform, setTform]     = useState(blankT);
  const [editId, setEditId]   = useState(null);
  const [history, setHistory] = useState([]);
  const [histAcc, setHistAcc] = useState(null);

  const load = () => api.accounts().then(setAccounts);
  useEffect(() => { load(); }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const tset = k => e => setTform(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (!form.name) return;
    if (editId) await api.put(`/accounts/${editId}`, form);
    else        await api.post('/accounts', form);
    setModal(null); load();
  }

  async function del(id) {
    if (!confirm('Excluir esta conta?')) return;
    await api.del(`/accounts/${id}`); load();
  }

  async function transfer() {
    if (!tform.from_account_id || !tform.to_account_id || !tform.amount) return;
    await api.transfers(tform);
    setModal(null); load();
  }

  async function openHistory(acc) {
    setHistAcc(acc);
    const txs = await api.transactions.list({ account_id: acc.id });
    setHistory(txs);
    setModal('history');
  }

  const total = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Contas</h1>
          <p className="text-sm text-slate-400">Total: <span className={`font-bold ${total>=0?'text-emerald-400':'text-rose-400'}`}>{fmtBRL(total)}</span></p>
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={() => { setTform(blankT); setModal('transfer'); }}>
            <ArrowLeftRight size={15} className="mr-1.5" />Transferir
          </Btn>
          <Btn onClick={() => { setForm(blank); setEditId(null); setModal('add'); }}>
            <Plus size={15} className="mr-1.5" />Nova conta
          </Btn>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map(a => (
          <div key={a.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: a.color }} />
                <div>
                  <div className="font-semibold text-white">{a.name}</div>
                  <div className="text-xs text-slate-400">{a.bank} · {a.type}</div>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setForm({ name:a.name, bank:a.bank, type:a.type, initial_balance:a.initial_balance, color:a.color }); setEditId(a.id); setModal('add'); }}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={() => del(a.id)}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <div className={`text-2xl font-bold ${a.balance>=0?'text-emerald-400':'text-rose-400'}`}>
              {fmtBRL(a.balance)}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Saldo inicial: {fmtBRL(a.initial_balance)}</div>
            <button onClick={() => openHistory(a)} className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              Ver histórico →
            </button>
          </div>
        ))}
      </div>

      {accounts.length === 0 && (
        <div className="text-center text-slate-500 py-20">
          <div className="text-4xl mb-3">🏦</div>
          <p>Nenhuma conta cadastrada.<br/>Clique em "Nova conta" para começar.</p>
        </div>
      )}

      {/* Add/Edit */}
      {(modal === 'add') && (
        <Modal title={editId ? 'Editar conta' : 'Nova conta'} onClose={() => setModal(null)}>
          <Field label="Nome da conta">
            <Input value={form.name} onChange={set('name')} placeholder="Ex: Conta Corrente Nubank" />
          </Field>
          <Field label="Banco">
            <Input value={form.bank} onChange={set('bank')} placeholder="Ex: Nubank" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <Select value={form.type} onChange={set('type')}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Saldo inicial (R$)">
              <Input type="number" step="0.01" value={form.initial_balance} onChange={set('initial_balance')} placeholder="0,00" />
            </Field>
          </div>
          <Field label="Cor">
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm(f=>({...f,color:c}))}
                  className={`w-7 h-7 rounded-full transition-transform ${form.color===c?'ring-2 ring-white scale-110':''}`}
                  style={{ background: c }} />
              ))}
            </div>
          </Field>
          <div className="flex gap-2 justify-end mt-2">
            <Btn variant="ghost" onClick={() => setModal(null)}>Cancelar</Btn>
            <Btn onClick={save}>{editId ? 'Salvar' : 'Criar conta'}</Btn>
          </div>
        </Modal>
      )}

      {/* Transfer */}
      {modal === 'transfer' && (
        <Modal title="Transferência entre contas" onClose={() => setModal(null)}>
          <Field label="Conta de origem">
            <Select value={tform.from_account_id} onChange={tset('from_account_id')}>
              <option value="">Selecione...</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({fmtBRL(a.balance)})</option>)}
            </Select>
          </Field>
          <Field label="Conta de destino">
            <Select value={tform.to_account_id} onChange={tset('to_account_id')}>
              <option value="">Selecione...</option>
              {accounts.filter(a => a.id !== tform.from_account_id).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$)">
              <Input type="number" step="0.01" value={tform.amount} onChange={tset('amount')} placeholder="0,00" />
            </Field>
            <Field label="Data">
              <Input type="date" value={tform.date} onChange={tset('date')} />
            </Field>
          </div>
          <Field label="Observações">
            <Input value={tform.notes} onChange={tset('notes')} placeholder="Opcional" />
          </Field>
          <div className="flex gap-2 justify-end mt-2">
            <Btn variant="ghost" onClick={() => setModal(null)}>Cancelar</Btn>
            <Btn onClick={transfer}>Transferir</Btn>
          </div>
        </Modal>
      )}

      {/* History */}
      {modal === 'history' && (
        <Modal title={`Histórico — ${histAcc?.name}`} onClose={() => setModal(null)} size="lg">
          {history.length === 0 ? (
            <div className="text-center text-slate-500 py-8">Nenhum lançamento nesta conta</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {history.map(t => (
                <div key={t.id} className="flex items-center justify-between p-2.5 bg-slate-700/50 rounded-lg">
                  <div>
                    <div className="text-sm text-white">{t.description}</div>
                    <div className="text-xs text-slate-400">{fmtDate(t.date)} · {t.category}</div>
                  </div>
                  <span className={`text-sm font-bold ${t.type==='income'?'text-emerald-400':'text-rose-400'}`}>
                    {t.type==='income'?'+':'−'}{fmtBRL(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
