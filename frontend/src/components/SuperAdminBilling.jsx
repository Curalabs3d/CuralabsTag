import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Save, Building2, X } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const STATUS_LABELS = {
  TRIAL: 'Teste', PENDING: 'Aguardando pagamento', ACTIVE: 'Ativa', PAST_DUE: 'Pendente', CANCELED: 'Cancelada',
};

function PlanForm({ plan, modules, onSaved, onCancel, token }) {
  const [name, setName] = useState(plan?.name || '');
  const [price, setPrice] = useState(plan?.monthly_price || '');
  const [description, setDescription] = useState(plan?.description || '');
  const [tagLimit, setTagLimit] = useState(plan?.tag_limit ?? '');
  const [selectedModules, setSelectedModules] = useState(plan?.included_modules || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const toggleModule = (key) => {
    setSelectedModules((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name, monthlyPrice: Number(price), description,
        tagLimit: tagLimit === '' ? null : Number(tagLimit),
        includedModules: selectedModules,
      };
      if (plan) await api.updatePlan(token, plan.id, payload);
      else await api.createPlan(token, payload);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="font-display text-sm font-semibold text-white">{plan ? `Editar: ${plan.name}` : 'Novo plano'}</h4>
        <button onClick={onCancel} className="text-white/40 hover:text-white"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-field">Nome</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="label-field">Preço mensal (R$)</label>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="input-field" />
        </div>
        <div className="col-span-2">
          <label className="label-field">Descrição</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="label-field">Limite de tags (vazio = ilimitado)</label>
          <input type="number" value={tagLimit} onChange={(e) => setTagLimit(e.target.value)} className="input-field" />
        </div>
      </div>

      <div className="mt-4">
        <label className="label-field">Módulos inclusos</label>
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
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
        Salvar plano
      </button>
    </div>
  );
}

export default function SuperAdminBilling() {
  const { token } = useAuth();
  const [plans, setPlans] = useState([]);
  const [modules, setModules] = useState({});
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState(null);
  const [creatingPlan, setCreatingPlan] = useState(false);

  const load = async () => {
    setLoading(true);
    const [plansData, modulesData, subsData] = await Promise.all([
      api.getAllPlans(token), api.getPublicPlans(), api.getAllSubscriptions(token),
    ]);
    setPlans(plansData.plans);
    setModules(modulesData.modules);
    setSubscriptions(subsData.subscriptions);
    setLoading(false);
  };

  useEffect(() => { load(); }, [token]);

  const onPlanSaved = () => {
    setEditingPlan(null);
    setCreatingPlan(false);
    load();
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div>;

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-white">Planos</h3>
          <button onClick={() => setCreatingPlan(true)} className="btn-secondary !py-1.5 text-xs"><Plus size={14} /> Novo plano</button>
        </div>

        {creatingPlan && (
          <div className="mb-4">
            <PlanForm modules={modules} onSaved={onPlanSaved} onCancel={() => setCreatingPlan(false)} token={token} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {plans.map((plan) => (
            editingPlan === plan.id ? (
              <div key={plan.id} className="sm:col-span-3">
                <PlanForm plan={plan} modules={modules} onSaved={onPlanSaved} onCancel={() => setEditingPlan(null)} token={token} />
              </div>
            ) : (
              <div key={plan.id} className={`card p-4 ${!plan.active ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <p className="font-display text-sm font-semibold text-white">{plan.name}</p>
                  {!plan.active && <span className="text-[10px] text-white/30">inativo</span>}
                </div>
                <p className="mt-1 font-display text-lg font-bold text-white">R$ {Number(plan.monthly_price).toFixed(0)}<span className="text-xs font-normal text-white/40">/mês</span></p>
                <p className="mt-1 text-xs text-white/40">{plan.tag_limit ? `até ${plan.tag_limit} tags` : 'ilimitado'}</p>
                <button onClick={() => setEditingPlan(plan.id)} className="btn-secondary mt-3 w-full !py-1.5 text-xs">Editar</button>
              </div>
            )
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-4 font-display text-sm font-semibold text-white">Assinaturas de todos os tenants</h3>
        {subscriptions.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 py-12 text-center">
            <Building2 className="text-white/20" size={24} />
            <p className="text-sm text-white/50">Nenhuma assinatura ainda.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/5 bg-base-800/50 text-xs uppercase tracking-wide text-white/40">
                <tr>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Plano</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Próx. cobrança</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {subscriptions.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white/90">{s.tenant_name}</td>
                    <td className="px-4 py-3 text-white/60">{s.plan_name}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${s.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : s.status === 'PAST_DUE' ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'bg-white/5 text-white/50 border border-white/10'}`}>
                        {STATUS_LABELS[s.status] || s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/50">{s.next_billing_date ? new Date(s.next_billing_date).toLocaleDateString('pt-BR') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
