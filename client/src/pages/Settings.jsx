import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Pencil, Download, Upload, AlertTriangle } from 'lucide-react';
import { api } from '../api';
import Modal, { Field, Input, Select, Btn } from '../components/Modal';

const ICONS  = ['📌','💰','🍽️','🚗','🏠','❤️','📚','🎮','👗','💡','📱','🐾','📋','✈️','🎓','💼','💻','📈','🛒','➕','➖'];
const COLORS = ['#6366f1','#10b981','#f43f5e','#f59e0b','#8b5cf6','#06b6d4','#ec4899','#84cc16','#f97316','#14b8a6'];

const blank = { name:'', type:'expense', color:'#6366f1', icon:'📌' };

export default function Settings() {
  const [cats, setCats]     = useState([]);
  const [modal, setModal]   = useState(null);
  const [form, setForm]     = useState(blank);
  const [editId, setEditId] = useState(null);
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg]       = useState('');

  const load = useCallback(() => { api.categories().then(setCats); }, []);
  useEffect(() => { load(); }, [load]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function savecat() {
    if (!form.name) return;
    if (editId) await api.put(`/categories/${editId}`, form);
    else        await api.post('/categories', form);
    setModal(null); load();
  }

  async function delcat(id) {
    if (!confirm('Excluir categoria?')) return;
    await api.del(`/categories/${id}`); load();
  }

  async function backup() {
    const data = await api.backup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    const nd=new Date(),nm=String(nd.getMonth()+1).padStart(2,'0'),ndd=String(nd.getDate()).padStart(2,'0');
    a.download = `backup-${nd.getFullYear()}-${nm}-${ndd}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function restore(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result);
        await api.restore(data);
        setMsg('✅ Backup restaurado com sucesso!');
        load();
      } catch (err) {
        setMsg('❌ Erro ao restaurar: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function clearAll() {
    if (confirm !== 'CONFIRMAR') {
      setMsg('❌ Digite CONFIRMAR para prosseguir.');
      return;
    }
    await api.clear();
    setConfirm('');
    setMsg('✅ Todos os dados foram apagados.');
    load();
  }

  const custom   = cats.filter(c => c.custom);
  const defaults = cats.filter(c => !c.custom);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-white mb-6">Configurações</h1>

      {msg && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${msg.startsWith('✅')?'bg-emerald-500/20 text-emerald-400':'bg-rose-500/20 text-rose-400'}`}>
          {msg}
          <button onClick={() => setMsg('')} className="ml-2 opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      {/* Categories */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-white">Categorias personalizadas</div>
          <Btn onClick={() => { setForm(blank); setEditId(null); setModal('cat'); }}>
            <Plus size={14} className="mr-1.5" />Nova categoria
          </Btn>
        </div>

        {custom.length === 0 ? (
          <div className="text-slate-500 text-sm py-4 text-center">Nenhuma categoria personalizada</div>
        ) : (
          <div className="space-y-2 mb-4">
            {custom.map(c => (
              <div key={c.id} className="flex items-center justify-between p-2.5 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span>{c.icon}</span>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                  <span className="text-sm text-white">{c.name}</span>
                  <span className="text-xs text-slate-500">{c.type==='income'?'Receita':'Despesa'}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setForm({ name:c.name, type:c.type, color:c.color, icon:c.icon }); setEditId(c.id); setModal('cat'); }}
                    className="p-1.5 rounded hover:bg-slate-600 text-slate-400 hover:text-white transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => delcat(c.id)}
                    className="p-1.5 rounded hover:bg-slate-600 text-slate-400 hover:text-rose-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-xs text-slate-500 mb-2">Categorias padrão ({defaults.length})</div>
        <div className="flex flex-wrap gap-1.5">
          {defaults.map(c => (
            <span key={c.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-slate-700 text-slate-300">
              {c.icon} {c.name}
            </span>
          ))}
        </div>
      </div>

      {/* Backup */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-4">
        <div className="text-sm font-semibold text-white mb-3">Backup e restauração</div>
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 p-3 bg-slate-700/50 rounded-lg">
            <Download size={18} className="text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm text-white font-medium">Exportar backup</div>
              <div className="text-xs text-slate-400 mb-2">Salva todos os dados em um arquivo JSON</div>
              <Btn onClick={backup}>Baixar backup</Btn>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-slate-700/50 rounded-lg">
            <Upload size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm text-white font-medium">Restaurar backup</div>
              <div className="text-xs text-slate-400 mb-2">Importa dados de um arquivo JSON exportado anteriormente</div>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 cursor-pointer transition-colors">
                <Upload size={14} />Escolher arquivo
                <input type="file" accept=".json" onChange={restore} className="hidden" />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Clear data */}
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={16} className="text-rose-400" />
          <div className="text-sm font-semibold text-rose-400">Apagar todos os dados</div>
        </div>
        <div className="text-xs text-slate-400 mb-3">
          Esta ação é <strong>irreversível</strong>. Todos os lançamentos, dívidas, investimentos, metas e contas serão excluídos permanentemente.
        </div>
        <div className="flex gap-2">
          <input value={confirm} onChange={e => setConfirm(e.target.value)}
            placeholder='Digite "CONFIRMAR" para habilitar'
            className="flex-1 bg-slate-900 border border-rose-500/40 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500" />
          <Btn variant="danger" onClick={clearAll} disabled={confirm !== 'CONFIRMAR'}>
            Apagar tudo
          </Btn>
        </div>
      </div>

      {/* Cat modal */}
      {modal === 'cat' && (
        <Modal title={editId ? 'Editar categoria' : 'Nova categoria'} onClose={() => setModal(null)}>
          <Field label="Nome">
            <Input value={form.name} onChange={set('name')} placeholder="Ex: Pets" />
          </Field>
          <Field label="Tipo">
            <Select value={form.type} onChange={set('type')}>
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </Select>
          </Field>
          <Field label="Ícone">
            <div className="flex flex-wrap gap-1">
              {ICONS.map(i => (
                <button key={i} onClick={() => setForm(f=>({...f,icon:i}))}
                  className={`text-xl p-1.5 rounded transition-colors ${form.icon===i?'bg-slate-600':''}`}>{i}</button>
              ))}
            </div>
          </Field>
          <Field label="Cor">
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm(f=>({...f,color:c}))}
                  className={`w-7 h-7 rounded-full transition-transform ${form.color===c?'ring-2 ring-white scale-110':''}`}
                  style={{ background: c }} />
              ))}
            </div>
          </Field>
          <div className="flex gap-2 justify-end mt-2">
            <Btn variant="ghost" onClick={() => setModal(null)}>Cancelar</Btn>
            <Btn onClick={savecat}>{editId?'Salvar':'Criar'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
