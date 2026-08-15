import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Ticket, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

// Página de resgate de voucher. Se o usuário não estiver logado, ele
// precisa entrar primeiro (o voucher é vinculado à empresa, não é anônimo)
// — mas o código já vem pré-preenchido a partir do QR code/link.
export default function RedeemVoucher() {
  const [searchParams] = useSearchParams();
  const { token, user } = useAuth();
  const [code, setCode] = useState(searchParams.get('codigo') || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await api.redeemVoucher(token, code);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token || !user) {
    const goToLogin = () => {
      if (code) sessionStorage.setItem('pending_voucher_code', code);
    };
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-950 px-4">
        <div className="card max-w-sm p-6 text-center">
          <Ticket className="mx-auto mb-3 text-accent" size={28} />
          <h1 className="font-display text-lg font-semibold text-white">Entre para resgatar</h1>
          <p className="mt-2 text-sm text-white/50">Você precisa estar logado com a conta da sua empresa para resgatar um voucher.</p>
          <Link to="/" onClick={goToLogin} className="btn-primary mt-5 w-full">Fazer login</Link>
        </div>
      </div>
    );
  }

  if (user.role !== 'TENANT_ADMIN') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-950 px-4">
        <div className="card max-w-sm p-6 text-center">
          <AlertCircle className="mx-auto mb-3 text-amber-400" size={28} />
          <h1 className="font-display text-lg font-semibold text-white">Acesso restrito</h1>
          <p className="mt-2 text-sm text-white/50">Só o administrador da empresa pode resgatar vouchers.</p>
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
          {result ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-3 text-emerald-400" size={32} />
              <h1 className="font-display text-lg font-semibold text-white">Voucher resgatado!</h1>
              <p className="mt-2 text-sm text-white/50">{result.message}</p>
              <Link to="/dashboard" className="btn-primary mt-6 w-full">Ir para o painel</Link>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="mb-4 flex items-center gap-2">
                <Ticket className="text-accent" size={20} />
                <h1 className="font-display text-lg font-semibold text-white">Resgatar voucher</h1>
              </div>

              <label className="label-field">Código do voucher</label>
              <input
                required value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="input-field font-mono text-center text-lg tracking-widest"
                placeholder="CÓDIGO"
              />

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" /> <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary mt-6 w-full">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Ticket size={16} />}
                {loading ? 'Resgatando...' : 'Resgatar'}
              </button>

              <Link to="/dashboard" className="mt-5 flex items-center justify-center gap-1 text-xs text-white/40 hover:text-white">
                <ArrowLeft size={13} /> Voltar ao painel
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
