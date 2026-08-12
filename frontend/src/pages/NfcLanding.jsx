import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Building2, Headset, Lock, Loader2, WifiOff } from 'lucide-react';
import { api } from '../api/client.js';
import { getContrastTextColor } from '../utils/color.js';

const DEFAULT_ACCENT = '#FF5C00';
const DEFAULT_BG = '#0A0A0A';

// Todas as cores da página vêm de 3 variáveis CSS, calculadas a partir da
// marca do tenant: --tenant-bg (fundo), --tenant-fg (texto, com contraste
// automático) e --tenant-accent (destaque). Isso permite que um tenant use
// fundo branco com texto escuro, outro mantenha o escuro com texto claro,
// e todo o resto da UI (opacidades, bordas) se adapta via color-mix().
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
          : 'border-[color-mix(in_srgb,var(--tenant-fg)_12%,transparent)] bg-[color-mix(in_srgb,var(--tenant-fg)_4%,transparent)] hover:border-[color-mix(in_srgb,var(--tenant-fg)_22%,transparent)] hover:bg-[color-mix(in_srgb,var(--tenant-fg)_7%,transparent)]'}`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${primary ? 'bg-[var(--tenant-accent)] text-base-950' : 'bg-[color-mix(in_srgb,var(--tenant-fg)_8%,transparent)] text-[color-mix(in_srgb,var(--tenant-fg)_75%,transparent)]'}`}>
        <Icon size={18} />
      </div>
      <span className={`font-display text-sm font-medium ${primary ? 'text-[var(--tenant-fg)]' : 'text-[color-mix(in_srgb,var(--tenant-fg)_85%,transparent)]'}`}>{label}</span>
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
  const background = company.backgroundColor || DEFAULT_BG;
  const foreground = getContrastTextColor(background);
  const mainLabel = company.mainLinkLabel || 'Ver Detalhes';
  const sacLabel = company.sacLinkLabel || 'Atendimento / SAC';
  const restrictedLabel = company.restrictedLinkLabel || 'Área Restrita';

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[var(--tenant-bg)]"
      style={{ '--tenant-bg': background, '--tenant-fg': foreground, '--tenant-accent': accent }}
    >
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[var(--tenant-accent)]/20 blur-[100px]" />

      <div className="relative z-10 flex min-h-screen flex-col px-6 py-10">
        <div className="mx-auto w-full max-w-sm flex-1">
          {/* Cartão de identidade do item físico */}
          <div className="mb-8 flex flex-col items-center text-center">
            {tag.photoUrl ? (
              <img src={tag.photoUrl} alt={tag.itemTitle} className="mb-5 h-40 w-full rounded-xl border border-[color-mix(in_srgb,var(--tenant-fg)_10%,transparent)] object-cover" />
            ) : (
              <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-2xl border border-[var(--tenant-accent)]/30 bg-[var(--tenant-accent)]/10">
                <Building2 className="text-[var(--tenant-accent)]" size={32} />
              </div>
            )}

            {company.logoUrl && (
              <img src={company.logoUrl} alt={company.name} className="mb-3 h-8 object-contain" />
            )}
            <p className="text-xs font-medium uppercase tracking-wider text-[color-mix(in_srgb,var(--tenant-fg)_45%,transparent)]">{company.name}</p>
            <h1 className="mt-1 font-display text-xl font-semibold text-[var(--tenant-fg)]">{tag.itemTitle || tag.tagId}</h1>
            {tag.itemCode && <p className="mt-1 font-mono text-xs text-[color-mix(in_srgb,var(--tenant-fg)_30%,transparent)]">{tag.itemCode}</p>}
            {company.welcomeMessage && (
              <p className="mt-3 text-sm text-[color-mix(in_srgb,var(--tenant-fg)_65%,transparent)]">{company.welcomeMessage}</p>
            )}
          </div>

          <div className="space-y-3">
            <ActionButton href={tag.mainLink} icon={Building2} label={mainLabel} primary />
            <ActionButton href={tag.sacLink} icon={Headset} label={sacLabel} />
            <ActionButton href={tag.restrictedLink} icon={Lock} label={restrictedLabel} />
          </div>
        </div>

        <footer className="mx-auto mt-10 w-full max-w-sm text-center">
          <p className="text-[11px] tracking-wide text-[color-mix(in_srgb,var(--tenant-fg)_25%,transparent)]">
            Tecnologia NFC por <span className="text-[var(--tenant-accent)]/70">CuraLabs3D</span>
          </p>
        </footer>
      </div>
    </div>
  );
}
