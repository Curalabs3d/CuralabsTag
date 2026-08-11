import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { api } from '../api/client.js';

const initialForm = {
  companyName: '', cnpj: '', contactEmail: '', contactPhone: '',
  adminName: '', adminEmail: '', password: '',
};

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.register(form);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-950 px-4">
        <div className="card max-w-sm p-8 text-center">
          <CheckCircle2 className="mx-auto mb-4 text-emerald-400" size={40} />
          <h1 className="font-display text-lg font-semibold text-white">Solicitação enviada</h1>
          <p className="mt-2 text-sm text-white/50">
            Sua empresa foi cadastrada com status <span className="text-amber-400">aguardando aprovação</span>.
            A equipe CuraLabs3D irá revisar e liberar o acesso em breve.
          </p>
          <Link to="/" className="btn-primary mt-6 w-full">Voltar para o login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-base-950 px-4 py-12">
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <Link to="/" className="flex items-center gap-1 text-xs text-white/40 hover:text-white">
            <ArrowLeft size={14} /> Voltar ao login
          </Link>
        </div>

        <form onSubmit={submit} className="card p-6">
          <div className="mb-5 flex items-center gap-2">
            <Building2 className="text-accent" size={20} />
            <h1 className="font-display text-lg font-semibold text-white">Solicitar conta corporativa</h1>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label-field">Nome da empresa *</label>
                <input required value={form.companyName} onChange={update('companyName')} className="input-field" placeholder="Ex: Giacomelli Imóveis" />
              </div>
              <div>
                <label className="label-field">CNPJ</label>
                <input value={form.cnpj} onChange={update('cnpj')} className="input-field" placeholder="00.000.000/0001-00" />
              </div>
              <div>
                <label className="label-field">Telefone</label>
                <input value={form.contactPhone} onChange={update('contactPhone')} className="input-field" placeholder="(00) 00000-0000" />
              </div>
              <div className="col-span-2">
                <label className="label-field">E-mail de contato *</label>
                <input type="email" required value={form.contactEmail} onChange={update('contactEmail')} className="input-field" placeholder="contato@empresa.com.br" />
              </div>
            </div>

            <div className="border-t border-white/5 pt-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/40">Usuário administrador</p>
              <div className="space-y-3">
                <div>
                  <label className="label-field">Seu nome *</label>
                  <input required value={form.adminName} onChange={update('adminName')} className="input-field" />
                </div>
                <div>
                  <label className="label-field">Seu e-mail de acesso *</label>
                  <input type="email" required value={form.adminEmail} onChange={update('adminEmail')} className="input-field" />
                </div>
                <div>
                  <label className="label-field">Senha *</label>
                  <input type="password" required minLength={6} value={form.password} onChange={update('password')} className="input-field" />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertCircle size={14} className="mt-0.5 shrink-0" /> <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary mt-6 w-full">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Enviando...' : 'Enviar solicitação'}
          </button>
        </form>
      </div>
    </div>
  );
}
