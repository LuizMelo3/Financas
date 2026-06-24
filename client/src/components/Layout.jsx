import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Wallet, TrendingUp, TrendingDown, CreditCard,
  PiggyBank, Target, BarChart3, FileText, Settings, Menu, X, Landmark, LogOut,
} from 'lucide-react';

const links = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Painel' },
  { to: '/accounts',     icon: Landmark,        label: 'Contas' },
  { to: '/income',       icon: TrendingUp,      label: 'Receitas' },
  { to: '/expenses',     icon: TrendingDown,    label: 'Despesas' },
  { to: '/debts',        icon: Wallet,          label: 'Dívidas' },
  { to: '/credit-cards', icon: CreditCard,      label: 'Cartões' },
  { to: '/investments',  icon: PiggyBank,       label: 'Investimentos' },
  { to: '/goals',        icon: Target,          label: 'Metas' },
  { to: '/budget',       icon: BarChart3,       label: 'Orçamento' },
  { to: '/reports',      icon: FileText,        label: 'Relatórios' },
  { to: '/settings',     icon: Settings,        label: 'Configurações' },
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('finance_user') || '{}'); }
    catch { return {}; }
  })();

  function logout() {
    localStorage.removeItem('finance_token');
    localStorage.removeItem('finance_user');
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900">
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-60 flex-shrink-0
        bg-slate-800 border-r border-slate-700 flex flex-col
        transform transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center gap-3 p-4 border-b border-slate-700">
          <span className="text-2xl">💰</span>
          <div className="min-w-0">
            <div className="font-bold text-white text-sm">FinanceiroApp</div>
            <div className="text-xs text-slate-400 truncate">{user.name || 'Controle financeiro'}</div>
          </div>
          <button onClick={() => setOpen(false)} className="ml-auto lg:hidden text-slate-400 hover:text-white flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-2 border-t border-slate-700">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition-colors"
          >
            <LogOut size={17} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-slate-800 border-b border-slate-700 flex-shrink-0">
          <button onClick={() => setOpen(true)} className="text-slate-400 hover:text-white">
            <Menu size={20} />
          </button>
          <span className="font-bold text-white text-sm flex-1">FinanceiroApp</span>
          <button onClick={logout} className="text-slate-400 hover:text-rose-400 transition-colors">
            <LogOut size={18} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
