import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Nfc, ScanLine, CheckCircle2, XCircle, Loader2, Clock, ShieldOff } from 'lucide-react';
import AppShell from '../components/AppShell.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className="rounded-lg bg-accent/10 p-2.5 text-accent"><Icon size={18} /></div>
      <div>
        <p className="text-lg font-semibold leading-none text-white">{value}</p>
        <p className="mt-1 text-xs text-white/40">{label}</p>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const { token } = useAuth();
  const [overview, setOverview] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, tn] = await Promise.all([
        api.tenantsOverview(token),
        api.listTenants(token, filter === 'ALL' ? undefined : filter),
      ]);
      setOverview(ov);
      setTenants(tn.tenants);
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => { load(); }, [load]);

  const act = async (id, action) => {
    setBusyId(id);
    try {
      if (action === 'approve') await api.approveTenant(token, id);
      if (action === 'reject') await api.rejectTenant(token, id);
      if (action === 'suspend') await api.suspendTenant(token, id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppShell
      title="Painel Master · CuraLabs3D"
      subtitle="Visão global de empresas (tenants) e chaveiros NFC do sistema."
    >
      {overview && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard icon={Building2} label="Empresas ativas" value={overview.activeTenants} />
          <StatCard icon={Clock} label="Aguardando aprovação" value={overview.pendingTenants} />
          <StatCard icon={Nfc} label="Chaveiros NFC ativos" value={overview.totalTags} />
          <StatCard icon={ScanLine} label="Acessos totais" value={overview.totalScans} />
        </div>
      )}

      <div className="mb-4 flex items-center gap-1 border-b border-white/5">
        {[
          { id: 'ALL', label: 'Todas' },
          { id: 'PENDING_APPROVAL', label: 'Aguardando aprovação' },
          { id: 'ACTIVE', label: 'Ativas' },
          { id: 'REJECTED', label: 'Rejeitadas' },
          { id: 'SUSPENDED', label: 'Suspensas' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px
              ${filter === f.id ? 'border-accent text-white' : 'border-transparent text-white/40 hover:text-white/70'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div>
      ) : tenants.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 py-16 text-center">
          <Building2 className="text-white/20" size={28} />
          <p className="text-sm text-white/50">Nenhuma empresa encontrada neste filtro.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/5 bg-base-800/50 text-xs uppercase tracking-wide text-white/40">
              <tr>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Contato</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Tags NFC</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tenants.map((t) => {
                const isBusy = busyId === t.id;
                return (
                  <tr key={t.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{t.name}</p>
                      <p className="text-xs text-white/30">/{t.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-white/50">{t.contact_email}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-right text-white/60">{t.tagCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {t.status === 'PENDING_APPROVAL' && (
                          <>
                            <button disabled={isBusy} onClick={() => act(t.id, 'approve')} className="rounded p-1.5 text-emerald-400 hover:bg-emerald-500/10" title="Aprovar">
                              <CheckCircle2 size={16} />
                            </button>
                            <button disabled={isBusy} onClick={() => act(t.id, 'reject')} className="rounded p-1.5 text-red-400 hover:bg-red-500/10" title="Rejeitar">
                              <XCircle size={16} />
                            </button>
                          </>
                        )}
                        {t.status === 'ACTIVE' && (
                          <button disabled={isBusy} onClick={() => act(t.id, 'suspend')} className="rounded p-1.5 text-white/40 hover:bg-white/5 hover:text-amber-400" title="Suspender">
                            <ShieldOff size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
