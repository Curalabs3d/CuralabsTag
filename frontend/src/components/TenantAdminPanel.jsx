import React, { useEffect, useState } from 'react';
import { Loader2, CreditCard, Nfc, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const STATUS_STYLES = {
  TRIAL: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
  PENDING: 'bg-white/5 text-white/50 border border-white/10',
  ACTIVE: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
  PAST_DUE: 'bg-red-500/10 text-red-400 border border-red-500/30',
  CANCELED: 'bg-white/5 text-white/40 border border-white/10',
};
const STATUS_LABELS = {
  TRIAL: 'Período de teste', PENDING: 'Aguardando pagamento', ACTIVE: 'Ativa',
  PAST_DUE: 'Pagamento pendente', CANCELED: 'Cancelada',
};

export default function TenantAdminPanel() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [subData, plansData] = await Promise.all([api.getMySubscription(token), api.getPublicPlans()]);
      setData(subData);
      setPlans(plansData.plans);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const upgrade = async (planId) => {
    setCheckingOut(planId);
    setError(null);
    try {
      const { checkoutUrl } = await api.startCheckout(token, planId);
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err.message);
      setCheckingOut(null);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div>;

  const { subscription, history, tagCount } = data || {};

  return (
    <div className="space-y-6">
      {/* Assinatura atual */}
      <div className="card p-5">
        <div className="mb-4 flex items-center gap-2">
          <CreditCard size={16} className="text-accent" />
          <h3 className="font-display text-sm font-semibold text-white">Sua assinatura</h3>
        </div>

        {subscription ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-white/40">Plano atual</p>
              <p className="mt-1 font-display text-sm font-semibold text-white">{subscription.plan_name}</p>
            </div>
            <div>
              <p className="text-xs text-white/40">Status</p>
              <span className={`badge mt-1 ${STATUS_STYLES[subscription.status] || ''}`}>
                {STATUS_LABELS[subscription.status] || subscription.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-white/40">Chaveiros usados</p>
              <p className="mt-1 flex items-center gap-1 text-sm text-white/80">
                <Nfc size={13} className="text-white/40" />
                {tagCount} {subscription.tag_limit ? `/ ${subscription.tag_limit}` : '(ilimitado)'}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/40">Próxima cobrança</p>
              <p className="mt-1 text-sm text-white/80">
                {subscription.next_billing_date ? new Date(subscription.next_billing_date).toLocaleDateString('pt-BR') : '—'}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-white/40">Nenhuma assinatura encontrada. Escolha um plano abaixo.</p>
        )}

        {subscription?.status === 'PAST_DUE' && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>Seu último pagamento não foi aprovado. Regularize em até {subscription.grace_period_days} dias para evitar a suspensão do acesso.</span>
          </div>
        )}
      </div>

      {/* Trocar de plano */}
      <div className="card p-5">
        <h3 className="mb-4 font-display text-sm font-semibold text-white">Planos disponíveis</h3>
        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = subscription?.plan_id === plan.id;
            return (
              <div key={plan.id} className={`rounded-lg border p-4 ${isCurrent ? 'border-accent/50 bg-accent/5' : 'border-white/10'}`}>
                <p className="font-display text-sm font-semibold text-white">{plan.name}</p>
                <p className="mt-1 font-display text-lg font-bold text-white">R$ {Number(plan.monthly_price).toFixed(0)}<span className="text-xs font-normal text-white/40">/mês</span></p>
                {isCurrent ? (
                  <span className="mt-3 flex items-center gap-1 text-xs text-accent"><CheckCircle2 size={13} /> Plano atual</span>
                ) : (
                  <button onClick={() => upgrade(plan.id)} disabled={checkingOut === plan.id} className="btn-secondary mt-3 w-full !py-1.5 text-xs">
                    {checkingOut === plan.id ? <Loader2 size={13} className="animate-spin" /> : 'Assinar este plano'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Histórico de cobranças */}
      <div className="card p-5">
        <h3 className="mb-4 font-display text-sm font-semibold text-white">Histórico de cobranças</h3>
        {!history || history.length === 0 ? (
          <p className="text-sm text-white/40">Nenhuma cobrança registrada ainda.</p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between border-b border-white/5 py-2 text-sm last:border-0">
                <span className="text-white/60">{h.paid_at ? new Date(h.paid_at).toLocaleDateString('pt-BR') : new Date(h.created_at).toLocaleDateString('pt-BR')}</span>
                <span className="text-white/80">R$ {Number(h.amount).toFixed(2)}</span>
                <span className={h.status === 'PAID' ? 'text-emerald-400' : h.status === 'FAILED' ? 'text-red-400' : 'text-white/40'}>
                  {h.status === 'PAID' ? 'Pago' : h.status === 'FAILED' ? 'Recusado' : 'Pendente'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
