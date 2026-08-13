import React, { useEffect, useState } from 'react';
import { Loader2, X, Puzzle } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function TenantModuleOverridesModal({ tenant, onClose }) {
  const { token } = useAuth();
  const [modules, setModules] = useState({});
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null);

  const load = async () => {
    setLoading(true);
    const [plansData, overridesData] = await Promise.all([
      api.getPublicPlans(),
      api.getTenantOverrides(token, tenant.id),
    ]);
    setModules(plansData.modules);
    setOverrides(overridesData.overrides);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenant.id]);

  const overrideFor = (key) => overrides.find((o) => o.module_key === key);

  const setOverride = async (key, enabled) => {
    setBusyKey(key);
    try {
      await api.setTenantOverride(token, tenant.id, key, enabled);
      await load();
    } finally {
      setBusyKey(null);
    }
  };

  const clearOverride = async (key) => {
    setBusyKey(key);
    try {
      await api.removeTenantOverride(token, tenant.id, key);
      await load();
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="card w-full max-w-md p-6">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Puzzle size={16} className="text-accent" />
            <h2 className="font-display text-lg font-semibold text-white">Módulos — {tenant.name}</h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={18} /></button>
        </div>
        <p className="mb-4 text-xs text-white/40">
          Exceções pontuais fora do plano contratado. Sem exceção aqui, vale o que o plano da empresa já inclui.
        </p>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-accent" /></div>
        ) : (
          <div className="space-y-2">
            {Object.entries(modules).map(([key, m]) => {
              const override = overrideFor(key);
              const isBusy = busyKey === key;
              return (
                <div key={key} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2.5">
                  <div>
                    <p className="text-sm text-white/80">{m.label}</p>
                    {override && (
                      <p className={`text-[11px] ${override.enabled ? 'text-emerald-400' : 'text-red-400'}`}>
                        Exceção: {override.enabled ? 'liberado' : 'bloqueado'} manualmente
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {override ? (
                      <button disabled={isBusy} onClick={() => clearOverride(key)} className="btn-secondary !py-1 !px-2 text-[11px]">
                        Remover exceção
                      </button>
                    ) : (
                      <>
                        <button disabled={isBusy} onClick={() => setOverride(key, true)} className="rounded p-1.5 text-emerald-400 hover:bg-emerald-500/10" title="Liberar">
                          Liberar
                        </button>
                        <button disabled={isBusy} onClick={() => setOverride(key, false)} className="rounded p-1.5 text-red-400 hover:bg-red-500/10" title="Bloquear">
                          Bloquear
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
