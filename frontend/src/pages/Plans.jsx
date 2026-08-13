import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Loader2, ArrowLeft, Nfc } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { api } from '../api/client.js';

export default function Plans() {
  const [plans, setPlans] = useState([]);
  const [modules, setModules] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.getPublicPlans();
        if (!cancelled) {
          setPlans(data.plans);
          setModules(data.modules);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-base-950 px-4 py-12">
      <div className="absolute inset-0 bg-grid opacity-30" />

      <div className="relative z-10 mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <Logo />
          <Link to="/" className="flex items-center gap-1 text-xs text-white/40 hover:text-white">
            <ArrowLeft size={14} /> Voltar ao login
          </Link>
        </div>

        <div className="mb-12 text-center">
          <div className="mx-auto mb-4 flex w-fit items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/50">
            <Nfc size={12} className="text-accent" /> NFC Hub Manager
          </div>
          <h1 className="font-display text-3xl font-semibold text-white">Planos para sua empresa</h1>
          <p className="mt-2 text-white/50">Escolha o plano ideal para gerenciar seus chaveiros NFC.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {plans.map((plan, i) => (
              <div key={plan.id} className={`card flex flex-col p-6 ${i === 1 ? 'border-accent/50 shadow-glow' : ''}`}>
                {i === 1 && (
                  <span className="mb-3 w-fit rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
                    Mais popular
                  </span>
                )}
                <h3 className="font-display text-lg font-semibold text-white">{plan.name}</h3>
                <p className="mt-1 text-sm text-white/40">{plan.description}</p>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-bold text-white">
                    R$ {Number(plan.monthly_price).toFixed(0)}
                  </span>
                  <span className="text-sm text-white/40">/mês</span>
                </div>

                <p className="mt-3 text-xs text-white/50">
                  {plan.tag_limit ? `Até ${plan.tag_limit} chaveiros NFC` : 'Chaveiros ilimitados'}
                </p>

                <ul className="mt-5 flex-1 space-y-2.5">
                  {(plan.included_modules || []).map((key) => (
                    <li key={key} className="flex items-start gap-2 text-sm text-white/70">
                      <Check size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                      {modules[key]?.label || key}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/register"
                  className={i === 1 ? 'btn-primary mt-6 w-full' : 'btn-secondary mt-6 w-full'}
                >
                  Solicitar cadastro
                </Link>
              </div>
            ))}
          </div>
        )}

        <p className="mt-10 text-center text-[11px] text-white/20">
          Tecnologia NFC por CuraLabs3D — Engenharia e Manufatura Aditiva 3D
        </p>
      </div>
    </div>
  );
}
