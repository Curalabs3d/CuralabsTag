import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Loader2, Plus, X, Ticket, Copy, Check, Ban, QrCode } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const PUBLIC_BASE_URL = import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;

function VoucherForm({ modules, onCreated, onCancel, token }) {
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [durationDays, setDurationDays] = useState(7);
  const [maxRedemptions, setMaxRedemptions] = useState(1);
  const [selectedModules, setSelectedModules] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const toggleModule = (key) => {
    setSelectedModules((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };

  const save = async () => {
    if (selectedModules.length === 0) {
      setError('Selecione ao menos um módulo para o voucher liberar.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.createVoucher(token, {
        code: code || undefined,
        description,
        durationDays: Number(durationDays),
        maxRedemptions: Number(maxRedemptions),
        includedModules: selectedModules,
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="font-display text-sm font-semibold text-white">Novo voucher</h4>
        <button onClick={onCancel} className="text-white/40 hover:text-white"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-field">Código (opcional — gera automático se vazio)</label>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="input-field font-mono" placeholder="FEIRA2026" />
        </div>
        <div>
          <label className="label-field">Descrição</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="input-field" placeholder="Cortesia feira náutica" />
        </div>
        <div>
          <label className="label-field">Dias de acesso após resgate</label>
          <input type="number" min={1} value={durationDays} onChange={(e) => setDurationDays(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="label-field">Máximo de resgates</label>
          <input type="number" min={1} value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} className="input-field" />
        </div>
      </div>

      <div className="mt-4">
        <label className="label-field">Módulos liberados</label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(modules).map(([key, m]) => (
            <label key={key} className="flex items-center gap-2 rounded-md border border-white/10 px-2.5 py-2 text-xs text-white/70">
              <input type="checkbox" checked={selectedModules.includes(key)} onChange={() => toggleModule(key)} className="accent-accent" />
              {m.label}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

      <button onClick={save} disabled={saving} className="btn-primary mt-4">
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
        Criar voucher
      </button>
    </div>
  );
}

function VoucherQrModal({ voucher, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const redeemUrl = `${PUBLIC_BASE_URL}/resgatar?codigo=${voucher.code}`;

  useEffect(() => {
    QRCode.toDataURL(redeemUrl, { width: 320, margin: 1, color: { dark: '#0A0A0A', light: '#FFFFFF' } })
      .then(setQrDataUrl);
  }, [redeemUrl]);

  const copyLink = () => {
    navigator.clipboard.writeText(redeemUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="card w-full max-w-sm p-6 text-center">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-white">{voucher.code}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={18} /></button>
        </div>
        <p className="mb-4 text-xs text-white/40">{voucher.description || 'Sem descrição'}</p>

        {qrDataUrl ? (
          <img src={qrDataUrl} alt={`QR code do voucher ${voucher.code}`} className="mx-auto mb-4 rounded-lg border border-white/10" />
        ) : (
          <div className="flex h-80 items-center justify-center"><Loader2 className="animate-spin text-accent" /></div>
        )}

        <button onClick={copyLink} className="btn-secondary w-full">
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? 'Link copiado!' : 'Copiar link de resgate'}
        </button>
      </div>
    </div>
  );
}

export default function SuperAdminVouchers() {
  const { token } = useAuth();
  const [vouchers, setVouchers] = useState([]);
  const [modules, setModules] = useState({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [qrVoucher, setQrVoucher] = useState(null);

  const load = async () => {
    setLoading(true);
    const data = await api.getAllVouchers(token);
    setVouchers(data.vouchers);
    const plansData = await api.getPublicPlans();
    setModules(plansData.modules);
    setLoading(false);
  };

  useEffect(() => { load(); }, [token]);

  const deactivate = async (id) => {
    if (!confirm('Desativar este voucher? Ele deixará de poder ser resgatado.')) return;
    await api.deactivateVoucher(token, id);
    load();
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-white">Vouchers de acesso gratuito</h3>
        <button onClick={() => setCreating(true)} className="btn-secondary !py-1.5 text-xs"><Plus size={14} /> Novo voucher</button>
      </div>

      {creating && (
        <div className="mb-4">
          <VoucherForm modules={modules} onCreated={() => { setCreating(false); load(); }} onCancel={() => setCreating(false)} token={token} />
        </div>
      )}

      {vouchers.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 py-12 text-center">
          <Ticket className="text-white/20" size={24} />
          <p className="text-sm text-white/50">Nenhum voucher criado ainda.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/5 bg-base-800/50 text-xs uppercase tracking-wide text-white/40">
              <tr>
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Duração</th>
                <th className="px-4 py-3 font-medium">Resgates</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {vouchers.map((v) => (
                <tr key={v.id} className={`hover:bg-white/[0.02] ${!v.active ? 'opacity-40' : ''}`}>
                  <td className="px-4 py-3 font-mono text-accent">{v.code}</td>
                  <td className="px-4 py-3 text-white/60">{v.description || '—'}</td>
                  <td className="px-4 py-3 text-white/60">{v.duration_days} dias</td>
                  <td className="px-4 py-3 text-white/60">{v.redemption_count} / {v.max_redemptions}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${v.active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-white/40 border border-white/10'}`}>
                      {v.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => setQrVoucher(v)} className="rounded p-1.5 text-white/40 hover:bg-white/5 hover:text-accent" title="Ver QR code">
                        <QrCode size={15} />
                      </button>
                      {v.active && (
                        <button onClick={() => deactivate(v.id)} className="rounded p-1.5 text-white/40 hover:bg-red-500/10 hover:text-red-400" title="Desativar">
                          <Ban size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {qrVoucher && <VoucherQrModal voucher={qrVoucher} onClose={() => setQrVoucher(null)} />}
    </div>
  );
}
