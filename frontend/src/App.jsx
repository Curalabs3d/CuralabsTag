import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Plans from './pages/Plans.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import Dashboard from './pages/Dashboard.jsx';
import NfcLanding from './pages/NfcLanding.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      {/* 1. Landing Page / Login */}
      <Route path="/" element={<Login />} />

      {/* 2. Solicitação de conta corporativa */}
      <Route path="/register" element={<Register />} />

      {/* Página pública de venda (planos) */}
      <Route path="/planos" element={<Plans />} />

      {/* Recuperação de senha */}
      <Route path="/esqueci-senha" element={<ForgotPassword />} />
      <Route path="/redefinir-senha" element={<ResetPassword />} />

      {/* 3. Painel do Super Admin da CuraLabs3D */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['SUPER_ADMIN']}>
            <AdminPanel />
          </ProtectedRoute>
        }
      />

      {/* 4. Painel do Cliente Tenant */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute roles={['TENANT_ADMIN', 'TENANT_USER']}>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* 5. Landing Page pública acionada pelo chaveiro NFC */}
      <Route path="/nfc/:tagId" element={<NfcLanding />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
