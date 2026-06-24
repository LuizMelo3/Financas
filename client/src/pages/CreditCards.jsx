import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, ShoppingCart, CheckCircle } from 'lucide-react';
import { api } from '../api';
import { fmtBRL, fmtDate, todayISO } from '../utils';
import Modal, { Field, Input, Select, Btn } from '../components/Modal';

const COLORS = ['#6366f1','#f43f5e','#10b981','#f59e0b','#8b5cf6','#06b6d4'];
const blank  = { name:'', limit_total:'', closing_day:'5', due_day:'15', account_id:'', color:'#6366f1' };
const blankP = { description:'', total_amount:'', installments:'1', category:'', date:todayISO() };

export default function CreditCards() {
  const [cards, setCards]       = useState([]);
  const [accs, setAccs]         = useState([]);
  const [cats, setCats]         = useState([]);
  const [modal, setModal]       = useState(null);
  const [selected, setSelected] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [form, setForm]         = useState(blank);
  const [pform, setPform]       = useState(blankP);

  const load = useCallback(() => {
    api.cards.list().then(setCards);
    api.accounts().then(setAccs);
    api.categories('expense').then(setCats);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCard = async (c) => {
    setSelected(c);
    const p = await api.cards.purchases(c.id);
    setPurchases(p);
    setModal('detail');
  };

  const set  = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const pset = k => e => setPform(f => ({ ...f, [k]: e.target.value }));

  async function saveCard() {
    if (!form.name || !form.limit_total) return;
    await api.cards.create(form);
    setModal(null); load();
  }

  async function delCard(id) {
    if (!confirm('Excluir este cartão?')) return;
    await api.cards.del(id); load(); setModal(null);
  }

  async function savePurchase() {
    if (!pform.description || !pform.total_amount || !selected) return;
    await api.cards.buy(selected.id, pform);
    const p = await api.cards.purchases(selected.id);
    setPurchases(p);
    const updated = await api.cards.list();
    setCards(updated);
    setSelected(updated.find(c => c.id === selected.id) || selected);
    setModal('detail');
  }

  async function payPurchase(purchaseId) {
    if (!selected) return;
    await api.cards.pay(selected.id, purchaseId);
    const p = await api.cards.purchases(selected.id);
    setPurchases(p);
    const updated = await api.cards.list();
    setCards(updated);
    setSelected(updated.find(c => c.id === selected.id) || selected);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Cartões de crédito</h1>
        <Btn onClick={() => { setForm(blank); setModal('add'); }}>
          <Plus size={15} className="mr-1.5" />Novo cartão
        </Btn>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(c => {
          const pct = c.limit_total > 0 ? Math.min(100, (c.used / c.limit_total) * 100) : 0;
          return (
            <button key={c.id} onClick={() => openCard(c)} className="text-left bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-slate-500 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="font-semibold text-white">{c.name}</div>
                <div className="w-8 h-5 rounded" style={{ background: c.color }} />
              </div>
              <div className="text-xs text-slate-500 mb-1">Limite utilizado</div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-rose-400 font-bold">{fmtBRL(c.used)}</span>
                <span className="text-slate-400">de {fmtBRL(c.limit_total)}</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full transition-all ${pct>80?'bg-rose-500':pct>60?'bg-amber-500':'bg-emerald-500'}`}
                  style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>Fecha dia {c.closing_day}</span>
                <span>Vence dia {c.due_day}</span>
              </div>
            </button>
          );
        })}
      </div>

      {cards.length === 0 && (
        <div className="text-center text-slate-500 py-20">
          <div className="text-4xl mb-3">💳</div>
          <p>Nenhum cartão cadastrado.</p>
        </div>
      )}

      {/* Add card */}
      {modal === 'add' && (
        <Modal title="Novo cartão" onClose={() => setModal(null)}>
          <Field label="Nome do cartão">
            <Input value={form.name} onChange={set('name')} placeholder="Ex: Nubank Roxinho" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Limite total (R$)">
              <Input type="number" step="0.01" value={form.limit_total} onChange={set('limit_total')} placeholder="8.000,00" />
            </Field>
            <Field label="Conta para débito">
              <Select value={form.account_id} onChange={set('account_id')}>
                <option value="">Nenhuma</option>
                {accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dia de fechamento">
              <Input type="number" min="1" max="31" value={form.closing_day} onChange={set('closing_day')} />
            </Field>
            <Field label="Dia de vencimento">
              <Input type="number" min="1" max="31" value={form.due_day} onChange={set('due_day')} />
            </Field>
          </div>
          <Field label="Cor">
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm(f=>({...f,color:c}))}
                  className={`w-7 h-7 rounded-full transition-transform ${form.color===c?'ring-2 ring-white scale-110':''}`}
                  style={{ background: c }} />
              ))}
            </div>
          </Field>
          <div className="flex gap-2 justify-end mt-2">
            <Btn variant="ghost" onClick={() => setModal(null)}>Cancelar</Btn>
            <Btn onClick={saveCard}>Criar cartão</Btn>
          </div>
        </Modal>
      )}

      {/* Card detail */}
      {modal === 'detail' && selected && (
        <Modal title={selected.name} onClose={() => setModal(null)} size="lg">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400 mb-1">Limite</div>
              <div className="font-bold text-white">{fmtBRL(selected.limit_total)}</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400 mb-1">Utilizado</div>
              <div className="font-bold text-rose-400">{fmtBRL(selected.used)}</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400 mb-1">Disponível</div>
              <div className="font-bold text-emerald-400">{fmtBRL(selected.available)}</div>
            </div>
          </div>

          <div className="flex justify-between items-center mb-3">
            <div className="text-sm font-medium text-slate-300">Compras na fatura</div>
            <div className="flex gap-2">
              <Btn variant="ghost" onClick={() => delCard(selected.id)} className="text-xs">
                <Trash2 size={13} className="mr-1" />Excluir cartão
              </Btn>
              <Btn onClick={() => { setPform(blankP); setModal('purchase'); }} className="text-xs">
                <ShoppingCart size={13} className="mr-1" />Nova compra
              </Btn>
            </div>
          </div>

          {purchases.length === 0 ? (
            <div className="text-center text-slate-500 py-8">Nenhuma compra registrada</div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {purchases.map(p => (
                <div key={p.id} className={`flex items-center justify-between p-2.5 rounded-lg ${p.paid ? 'bg-slate-700/30 opacity-60' : 'bg-slate-700/50'}`}>
                  <div>
                    <div className="text-sm text-white">{p.description}</div>
                    <div className="text-xs text-slate-400">{fmtDate(p.date)} · {p.installments}x · {p.category}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-rose-400">{fmtBRL(p.total_amount)}</span>
                    {!p.paid && (
                      <button onClick={() => payPurchase(p.id)} title="Pagar fatura"
                        className="p-1 rounded hover:bg-slate-600 text-slate-400 hover:text-emerald-400 transition-colors">
                        <CheckCircle size={14} />
                      </button>
                    )}
                    {p.paid && <span className="text-xs text-emerald-400">Pago</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* New purchase */}
      {modal === 'purchase' && selected && (
        <Modal title="Nova compra" onClose={() => setModal('detail')}>
          <Field label="Descrição">
            <Input value={pform.description} onChange={pset('description')} placeholder="Ex: Camisa polo" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor total (R$)">
              <Input type="number" step="0.01" value={pform.total_amount} onChange={pset('total_amount')} placeholder="0,00" />
            </Field>
            <Field label="Parcelas">
              <Input type="number" min="1" max="48" value={pform.installments} onChange={pset('installments')} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <Select value={pform.category} onChange={pset('category')}>
                <option value="">Selecione...</option>
                {cats.map(c => <option key={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Data da compra">
              <Input type="date" value={pform.date} onChange={pset('date')} />
            </Field>
          </div>
          {pform.total_amount && pform.installments > 1 && (
            <div className="text-xs text-slate-400 bg-slate-700/50 rounded-lg p-2">
              {pform.installments}x de {fmtBRL(parseFloat(pform.total_amount)/parseInt(pform.installments)||0)}
            </div>
          )}
          <div className="flex gap-2 justify-end mt-3">
            <Btn variant="ghost" onClick={() => setModal('detail')}>Cancelar</Btn>
            <Btn onClick={savePurchase}>Registrar compra</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
