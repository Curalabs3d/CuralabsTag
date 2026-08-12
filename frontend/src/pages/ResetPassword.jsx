import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import PasswordField from '../components/PasswordField.jsx';
import { api } from '../api/client.js';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/'), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-950 px-4">
        <div className="card max-w-sm p-6 text-center">
          <AlertCircle className="mx-auto mb-3 text-red-400" size={28} />
          <h1 className="font-display text-lg font-semibold text-white">Link inválido</h1>
          <p className="mt-2 text-sm text-white/50">Este link de redefinição de senha está incompleto ou é inválido.</p>
          <Link to="/esqueci-senha" className="btn-primary mt-5 w-full">Solicitar novo link</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-base-950 px-4">
      <div className="absolute inset-0 bg-grid opacity-40" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size="lg" />
        </div>

        <div className="card p-6">
          {done ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-3 text-emerald-400" size={32} />
              <h1 className="font-display text-lg font-semibold text-white">Senha redefinida!</h1>
              <p className="mt-2 text-sm text-white/50">Redirecionando para o login...</p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <h1 className="font-display text-lg font-semibold text-white">Criar nova senha</h1>
              <p className="mt-1 text-sm text-white/40">Escolha uma nova senha para sua conta.</p>

              <div className="mt-5 space-y-4">
                <PasswordField
                  label="Nova senha" required minLength={6}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <PasswordField
                  label="Confirme a nova senha" required minLength={6}
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" /> <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary mt-6 w-full">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                {loading ? 'Salvando...' : 'Redefinir senha'}
              </button>

              <Link to="/" className="mt-5 flex items-center justify-center gap-1 text-xs text-white/40 hover:text-white">
                <ArrowLeft size={13} /> Voltar ao login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
