import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Cpu } from 'lucide-react';
import { NFC_MODELS, validateTagCapacity } from '../utils/nfcCapacity.js';

const LINK_LABELS = {
  mainLink: 'Link Principal',
  sacLink: 'Link SAC',
  restrictedLink: 'Link Área Restrita',
};

export default function NfcCapacityPanel({
  hubUrl,
  model, onModelChange,
  writeMode, onWriteModeChange,
  customCapacityBytes, onCustomCapacityChange,
  links, // { mainLink, sacLink, restrictedLink }
  selectedLinks, onToggleLink, // array + setter
}) {
  const capacity = useMemo(() => validateTagCapacity({
    model, customCapacityBytes, writeMode, hubUrl, links, selectedLinks,
  }), [model, customCapacityBytes, writeMode, hubUrl, links, selectedLinks]);

  const percent = capacity.capacityBytes > 0
    ? Math.min(100, Math.round((capacity.bytesUsed / capacity.capacityBytes) * 100))
    : 0;

  const barColor = !capacity.fits ? 'bg-red-500' : percent > 80 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="rounded-lg border border-white/10 bg-base-950 p-4">
      <div className="mb-3 flex items-center gap-2 text-white/70">
        <Cpu size={15} className="text-accent" />
        <span className="font-display text-xs font-semibold uppercase tracking-wide">Capacidade da tag NFC</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-field">Modelo</label>
          <select value={model} onChange={(e) => onModelChange(e.target.value)} className="input-field">
            {Object.entries(NFC_MODELS).map(([key, m]) => (
              <option key={key} value={key}>{m.label}{m.usableBytes ? ` (${m.usableBytes} bytes)` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">Modo de gravação</label>
          <select value={writeMode} onChange={(e) => onWriteModeChange(e.target.value)} className="input-field">
            <option value="HUB">Hub (recomendado)</option>
            <option value="DIRECT">Direto (grava link real)</option>
          </select>
        </div>
      </div>

      {model === 'CUSTOM' && (
        <div className="mt-3">
          <label className="label-field">Capacidade personalizada (bytes)</label>
          <input
            type="number" min={0} value={customCapacityBytes || ''}
            onChange={(e) => onCustomCapacityChange(Number(e.target.value) || 0)}
            className="input-field" placeholder="Ex: 144"
          />
        </div>
      )}

      {writeMode === 'HUB' ? (
        <p className="mt-3 text-xs text-white/40">
          No modo Hub, o chip grava apenas a URL curta do hub (<span className="font-mono text-white/60">{hubUrl}</span>).
          Os links de destino ficam no sistema e podem ser trocados depois sem regravar o chaveiro.
        </p>
      ) : (
        <div className="mt-3">
          <p className="mb-2 text-xs text-white/40">
            Escolha quais links serão gravados diretamente no chip (sem espaços reservados para os não marcados):
          </p>
          <div className="space-y-1.5">
            {Object.entries(LINK_LABELS).map(([key, label]) => (
              <label key={key} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${links[key] ? 'text-white/80' : 'text-white/25'}`}>
                <input
                  type="checkbox"
                  disabled={!links[key]}
                  checked={selectedLinks.includes(key)}
                  onChange={() => onToggleLink(key)}
                  className="h-3.5 w-3.5 rounded border-white/20 bg-base-900 accent-accent"
                />
                {label}
                {!links[key] && <span className="text-[10px] text-white/20">(vazio)</span>}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Barra de capacidade */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className={capacity.fits ? 'text-white/50' : 'text-red-400'}>
            {capacity.bytesUsed} / {capacity.capacityBytes} bytes
          </span>
          {capacity.fits ? (
            <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 size={12} /> Cabe no chip</span>
          ) : (
            <span className="flex items-center gap-1 text-red-400"><AlertTriangle size={12} /> Excede a capacidade</span>
          )}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className={`h-full transition-all ${barColor}`} style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
}

export { validateTagCapacity as computeCapacity };
