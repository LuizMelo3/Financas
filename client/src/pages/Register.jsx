import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';

export default function Register() {
  const [form, setForm]       = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('As senhas não coincidem');
    if (form.password.length < 6) return setError('Senha deve ter no mínimo 6 caracteres');
    setLoading(true);
    try {
      const { token, user } = await api.auth.register({
        name: form.name, email: form.email, password: form.password,
      });
      localStorage.setItem('finance_token', token);
      localStorage.setItem('finance_user', JSON.stringify(user));
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">💰</div>
          <h1 className="text-2xl font-bold text-white">Grana</h1>
          <p className="text-slate-400 text-sm mt-1">Controle financeiro pessoal</p>
        </div>

        <form onSubmit={submit} className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Criar conta</h2>

          {error && (
            <div className="bg-rose-500/20 border border-rose-500/30 text-rose-400 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome</label>
            <input
              type="text" required autoFocus
              value={form.name} onChange={set('name')}
              placeholder="Seu nome"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">E-mail</label>
            <input
              type="email" required
              value={form.email} onChange={set('email')}
              placeholder="seu@email.com"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Senha</label>
            <input
              type="password" required
              value={form.password} onChange={set('password')}
              placeholder="Mínimo 6 caracteres"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirmar senha</label>
            <input
              type="password" required
              value={form.confirm} onChange={set('confirm')}
              placeholder="Repita a senha"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>

          <p className="text-center text-sm text-slate-400">
            Já tem conta?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
