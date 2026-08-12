import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, Loader2, AlertCircle, Nfc } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import PasswordField from '../components/PasswordField.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'SUPER_ADMIN' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-base-950 px-4">
      <div className="absolute inset-0 bg-grid bg-grid opacity-40" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size="lg" />
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/50">
            <Nfc size={12} className="text-accent" />
            NFC Hub Manager
          </div>
        </div>

        <form onSubmit={submit} className="card p-6">
          <h1 className="font-display text-lg font-semibold text-white">Acessar painel</h1>
          <p className="mt-1 text-sm text-white/40">Entre com suas credenciais corporativas.</p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="label-field">E-mail</label>
              <input
                type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field" placeholder="voce@empresa.com.br"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="label-field !mb-0">Senha</label>
                <Link to="/esqueci-senha" className="mb-1.5 text-[11px] font-medium text-accent hover:text-accent-hover">
                  Esqueci minha senha
                </Link>
              </div>
              <PasswordField
                required value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertCircle size={14} className="mt-0.5 shrink-0" /> <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary mt-6 w-full">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <p className="mt-5 text-center text-xs text-white/30">
            Sua empresa ainda não tem acesso?{' '}
            <Link to="/register" className="font-medium text-accent hover:text-accent-hover">
              Solicitar cadastro
            </Link>
          </p>
        </form>

        <p className="mt-6 text-center text-[11px] text-white/20">
          Tecnologia NFC por CuraLabs3D — Engenharia e Manufatura Aditiva 3D
        </p>
      </div>
    </div>
  );
}
