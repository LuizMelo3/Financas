import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, size = 'md' }) {
  const ref = useRef();

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-3xl' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={ref} className={`w-full ${sizes[size]} bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="font-semibold text-white text-base">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, className = '' }) {
  return (
    <div className={`mb-4 ${className}`}>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export function Input(props) {
  return (
    <input
      {...props}
      className={`w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors ${props.className||''}`}
    />
  );
}

export function Select({ children, ...props }) {
  return (
    <select
      {...props}
      className={`w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors ${props.className||''}`}
    >
      {children}
    </select>
  );
}

export function Textarea(props) {
  return (
    <textarea
      rows={3}
      {...props}
      className={`w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none ${props.className||''}`}
    />
  );
}

export function Btn({ children, variant = 'primary', className = '', ...props }) {
  const base = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50';
  const variants = {
    primary:  'bg-indigo-600 hover:bg-indigo-700 text-white',
    success:  'bg-emerald-600 hover:bg-emerald-700 text-white',
    danger:   'bg-rose-600 hover:bg-rose-700 text-white',
    ghost:    'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600',
    warning:  'bg-amber-600 hover:bg-amber-700 text-white',
  };
  return <button {...props} className={`${base} ${variants[variant]} ${className}`}>{children}</button>;
}
