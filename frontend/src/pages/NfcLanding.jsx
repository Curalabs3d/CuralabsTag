import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Building2, Headset, Lock, Loader2, WifiOff } from 'lucide-react';
import { api } from '../api/client.js';

const DEFAULT_ACCENT = '#FF5C00';

// Usa a cor de marca do tenant via variável CSS (--tenant-accent), com fallback
// para o laranja padrão da CuraLabs3D caso o tenant não tenha configurado uma.
function ActionButton({ href, icon: Icon, label, primary }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`group flex items-center gap-3 rounded-xl border px-4 py-4 transition-all active:scale-[0.98]
        ${primary
          ? 'border-[var(--tenant-accent)]/40 bg-[var(--tenant-accent)]/10 hover:bg-[var(--tenant-accent)]/15'
          : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'}`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${primary ? 'bg-[var(--tenant-accent)] text-base-950' : 'bg-white/5 text-white/70'}`}>
        <Icon size={18} />
      </div>
      <span className={`font-display text-sm font-medium ${primary ? 'text-white' : 'text-white/80'}`}>{label}</span>
    </a>
  );
}

export default function NfcLanding() {
  const { tagId } = useParams();
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.getPublicTag(tagId);
        if (!cancelled) setState({ loading: false, data, error: null });
      } catch (err) {
        if (!cancelled) setState({ loading: false, data: null, error: err.message });
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tagId]);

  if (state.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-950">
        <Loader2 className="animate-spin text-accent" size={28} />
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-base-950 px-6 text-center">
        <WifiOff className="text-white/20" size={32} />
        <h1 className="font-display text-base font-semibold text-white">Chaveiro não encontrado</h1>
        <p className="max-w-xs text-sm text-white/40">{state.error}</p>
      </div>
    );
  }

  const { tag, company } = state.data;
  const accent = company.brandColor || DEFAULT_ACCENT;

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-base-950"
      style={{ '--tenant-accent': accent }}
    >
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[var(--tenant-accent)]/20 blur-[100px]" />

      <div className="relative z-10 flex min-h-screen flex-col px-6 py-10">
        <div className="mx-auto w-full max-w-sm flex-1">
          {/* Cartão de identidade do item físico */}
          <div className="mb-8 flex flex-col items-center text-center">
            {tag.photoUrl ? (
              <img src={tag.photoUrl} alt={tag.itemTitle} className="mb-5 h-40 w-full rounded-xl border border-white/10 object-cover" />
            ) : (
              <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-2xl border border-[var(--tenant-accent)]/30 bg-[var(--tenant-accent)]/10">
                <Building2 className="text-[var(--tenant-accent)]" size={32} />
              </div>
            )}

            {company.logoUrl && (
              <img src={company.logoUrl} alt={company.name} className="mb-3 h-8 object-contain" />
            )}
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">{company.name}</p>
            <h1 className="mt-1 font-display text-xl font-semibold text-white">{tag.itemTitle || tag.tagId}</h1>
            {tag.itemCode && <p className="mt-1 font-mono text-xs text-white/30">{tag.itemCode}</p>}
            {company.welcomeMessage && (
              <p className="mt-3 text-sm text-white/60">{company.welcomeMessage}</p>
            )}
          </div>

          <div className="space-y-3">
            <ActionButton href={tag.mainLink} icon={Building2} label="Ver Detalhes" primary />
            <ActionButton href={tag.sacLink} icon={Headset} label="Atendimento / SAC" />
            <ActionButton href={tag.restrictedLink} icon={Lock} label="Área Restrita" />
          </div>
        </div>

        <footer className="mx-auto mt-10 w-full max-w-sm text-center">
          <p className="text-[11px] tracking-wide text-white/25">
            Tecnologia NFC por <span className="text-accent/70">CuraLabs3D</span>
          </p>
        </footer>
      </div>
    </div>
  );
}
