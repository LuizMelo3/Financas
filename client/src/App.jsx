import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout       from './components/Layout';
import Login        from './pages/Login';
import Register     from './pages/Register';
import Dashboard    from './pages/Dashboard';
import Accounts     from './pages/Accounts';
import Income       from './pages/Income';
import Expenses     from './pages/Expenses';
import Debts        from './pages/Debts';
import CreditCards  from './pages/CreditCards';
import Investments  from './pages/Investments';
import Goals        from './pages/Goals';
import Budget       from './pages/Budget';
import Reports      from './pages/Reports';
import Settings     from './pages/Settings';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('finance_token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"    element={<Dashboard />} />
        <Route path="accounts"     element={<Accounts />} />
        <Route path="income"       element={<Income />} />
        <Route path="expenses"     element={<Expenses />} />
        <Route path="debts"        element={<Debts />} />
        <Route path="credit-cards" element={<CreditCards />} />
        <Route path="investments"  element={<Investments />} />
        <Route path="goals"        element={<Goals />} />
        <Route path="budget"       element={<Budget />} />
        <Route path="reports"      element={<Reports />} />
        <Route path="settings"     element={<Settings />} />
      </Route>
    </Routes>
  );
}
