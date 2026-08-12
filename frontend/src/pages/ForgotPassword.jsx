import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { api } from '../api/client.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-base-950 px-4">
      <div className="absolute inset-0 bg-grid opacity-40" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size="lg" />
        </div>

        <div className="card p-6">
          {sent ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-3 text-emerald-400" size={32} />
              <h1 className="font-display text-lg font-semibold text-white">Verifique seu e-mail</h1>
              <p className="mt-2 text-sm text-white/50">
                Se <span className="text-white/80">{email}</span> estiver cadastrado, você vai receber um link para redefinir sua senha em alguns instantes.
              </p>
              <Link to="/" className="btn-secondary mt-6 w-full">Voltar ao login</Link>
            </div>
          ) : (
            <form onSubmit={submit}>
              <h1 className="font-display text-lg font-semibold text-white">Esqueci minha senha</h1>
              <p className="mt-1 text-sm text-white/40">
                Digite seu e-mail de acesso e enviaremos um link para você criar uma nova senha.
              </p>

              <div className="mt-5">
                <label className="label-field">E-mail</label>
                <input
                  type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field" placeholder="voce@empresa.com.br"
                />
              </div>

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" /> <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary mt-6 w-full">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
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
