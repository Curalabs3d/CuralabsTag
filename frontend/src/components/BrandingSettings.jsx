import React, { useEffect, useState } from 'react';
import { Loader2, Save, CheckCircle2, Building2, Headset, Lock, Palette } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getContrastTextColor } from '../utils/color.js';

const DEFAULT_ACCENT = '#FF5C00';
const DEFAULT_BG = '#0A0A0A';

function ColorField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="label-field">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color" value={/^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded border border-white/10 bg-base-950"
        />
        <input
          value={value} onChange={(e) => onChange(e.target.value)}
          className="input-field font-mono" placeholder={placeholder}
        />
      </div>
    </div>
  );
}

export default function BrandingSettings() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [brandColor, setBrandColor] = useState(DEFAULT_ACCENT);
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_BG);
  const [welcomeMessage, setWelcomeMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { branding } = await api.getBranding(token);
        if (cancelled) return;
        setName(branding.name || '');
        setLogoUrl(branding.logo_url || '');
        setBrandColor(branding.brand_color || DEFAULT_ACCENT);
        setBackgroundColor(branding.background_color || DEFAULT_BG);
        setWelcomeMessage(branding.welcome_message || '');
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api.updateBranding(token, { name, logoUrl, brandColor, backgroundColor, welcomeMessage });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div>;
  }

  const previewAccent = /^#[0-9A-Fa-f]{6}$/.test(brandColor) ? brandColor : DEFAULT_ACCENT;
  const previewBg = /^#[0-9A-Fa-f]{6}$/.test(backgroundColor) ? backgroundColor : DEFAULT_BG;
  const previewFg = getContrastTextColor(previewBg);
  // Aplica opacidade sem depender de color-mix no preview (mais previsível
  // em qualquer navegador para essa área específica de pré-visualização).
  const fgMuted = (alphaHex) => `${previewFg}${alphaHex}`;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Formulário */}
      <form onSubmit={save} className="card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Palette size={16} className="text-accent" />
          <h3 className="font-display text-sm font-semibold text-white">Marca da sua empresa</h3>
        </div>
        <p className="mb-5 text-xs text-white/40">
          Essas configurações aparecem apenas na página pública que o cliente final vê ao aproximar o chaveiro NFC — o painel de gestão continua com a identidade CuraLabs3D.
        </p>

        <div className="space-y-4">
          <div>
            <label className="label-field">Nome da empresa</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              className="input-field" placeholder="Ex: Giacomelli Imóveis" required
            />
          </div>

          <div>
            <label className="label-field">URL do logotipo</label>
            <input
              value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)}
              className="input-field" placeholder="https://suaempresa.com.br/logo.png"
            />
          </div>

          <ColorField label="Cor de destaque (botões e ícones)" value={brandColor} onChange={setBrandColor} placeholder="#FF5C00" />
          <ColorField label="Cor de fundo da página" value={backgroundColor} onChange={setBackgroundColor} placeholder="#0A0A0A ou #FFFFFF" />
          <p className="-mt-2 text-[11px] text-white/30">
            A cor do texto se ajusta automaticamente (claro ou escuro) para continuar legível em qualquer fundo escolhido.
          </p>

          <div>
            <label className="label-field">Mensagem de boas-vindas (opcional)</label>
            <textarea
              value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value.slice(0, 160))}
              rows={3} className="input-field resize-none"
              placeholder="Ex: Bem-vindo! Estamos felizes em atender você."
            />
            <p className="mt-1 text-right text-[11px] text-white/30">{welcomeMessage.length}/160</p>
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <button type="submit" disabled={saving} className="btn-primary mt-5 w-full">
          {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar marca'}
        </button>
      </form>

      {/* Preview ao vivo, no mesmo estilo da página pública */}
      <div className="card overflow-hidden p-0">
        <div className="border-b border-white/5 bg-base-800/50 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-white/40">
          Pré-visualização da página do chaveiro
        </div>
        <div className="relative p-8 transition-colors" style={{ backgroundColor: previewBg }}>
          <div className="pointer-events-none absolute -top-20 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full opacity-20 blur-[80px]" style={{ backgroundColor: previewAccent }} />
          <div className="relative z-10 mx-auto max-w-xs text-center">
            {logoUrl ? (
              <img src={logoUrl} alt="logo" className="mx-auto mb-4 h-10 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
            ) : (
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border" style={{ borderColor: `${previewAccent}4D`, backgroundColor: `${previewAccent}1A` }}>
                <Building2 style={{ color: previewAccent }} size={24} />
              </div>
            )}
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: fgMuted('73') }}>{name || 'Nome da Empresa'}</p>
            <h4 className="mt-1 font-display text-base font-semibold" style={{ color: previewFg }}>Apartamento Exemplo, 101</h4>
            {welcomeMessage && <p className="mt-2 text-xs" style={{ color: fgMuted('A6') }}>{welcomeMessage}</p>}

            <div className="mt-5 space-y-2">
              <div className="flex items-center gap-2.5 rounded-lg border px-3 py-3 text-left" style={{ borderColor: `${previewAccent}66`, backgroundColor: `${previewAccent}1A` }}>
                <Building2 size={15} style={{ color: previewAccent }} />
                <span className="font-display text-xs font-medium" style={{ color: previewFg }}>Ver Detalhes</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border px-3 py-3 text-left" style={{ borderColor: fgMuted('1A'), backgroundColor: fgMuted('0A') }}>
                <Headset size={15} style={{ color: fgMuted('99') }} />
                <span className="font-display text-xs font-medium" style={{ color: fgMuted('D9') }}>Atendimento / SAC</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border px-3 py-3 text-left" style={{ borderColor: fgMuted('1A'), backgroundColor: fgMuted('0A') }}>
                <Lock size={15} style={{ color: fgMuted('99') }} />
                <span className="font-display text-xs font-medium" style={{ color: fgMuted('D9') }}>Área Restrita</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
