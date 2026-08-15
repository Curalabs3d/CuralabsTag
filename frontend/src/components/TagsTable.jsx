import React, { useState } from 'react';
import { Pencil, Trash2, Save, X, ExternalLink, Nfc, AlertTriangle } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import NfcCapacityPanel from './NfcCapacityPanel.jsx';

function EditableCell({ value, onChange, placeholder }) {
  return (
    <input
      value={value || ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-white/10 bg-base-950 px-2 py-1.5 text-xs text-white outline-none focus:border-accent/50"
    />
  );
}

function ModelBadge({ tag }) {
  const fits = tag.capacity?.fits ?? true;
  return (
    <div className="flex flex-col gap-1">
      <span className="badge w-fit border border-white/10 bg-white/5 text-white/60">
        {tag.nfc_model}
      </span>
      <span className={`text-[10px] ${tag.write_mode === 'DIRECT' ? 'text-accent/70' : 'text-white/30'}`}>
        {tag.write_mode === 'DIRECT' ? 'Direto' : 'Hub'}
      </span>
      {!fits && (
        <span className="flex items-center gap-1 text-[10px] text-red-400" title="Configuração excede a capacidade do chip">
          <AlertTriangle size={10} /> excede
        </span>
      )}
    </div>
  );
}

export default function TagsTable({ tags, onChange, publicBaseUrl, branding }) {
  const { token } = useAuth();
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});
  const [busyId, setBusyId] = useState(null);

  const mainLinkLabel = branding?.main_link_label || 'Link Principal';
  const sacLinkLabel = branding?.sac_link_label || 'SAC';
  const restrictedLinkLabel = branding?.restricted_link_label || 'Área Restrita';

  const startEdit = (tag) => {
    setEditingId(tag.id);
    setDraft({
      itemCode: tag.item_code,
      itemTitle: tag.item_title,
      mainLink: tag.main_link,
      sacLink: tag.sac_link,
      restrictedLink: tag.restricted_link,
      nfcModel: tag.nfc_model,
      writeMode: tag.write_mode,
      customCapacityBytes: tag.custom_capacity_bytes || 144,
      directLinksSelected: tag.direct_links_selected || [],
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };

  const toggleDraftLink = (key) => {
    setDraft((d) => ({
      ...d,
      directLinksSelected: d.directLinksSelected.includes(key)
        ? d.directLinksSelected.filter((k) => k !== key)
        : [...d.directLinksSelected, key],
    }));
  };

  const [saveError, setSaveError] = useState(null);

  const saveEdit = async (id) => {
    setBusyId(id);
    setSaveError(null);
    try {
      await api.updateTag(token, id, draft);
      cancelEdit();
      onChange();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id) => {
    if (!confirm('Remover esta tag NFC? Essa ação não pode ser desfeita.')) return;
    setBusyId(id);
    try {
      await api.deleteTag(token, id);
      onChange();
    } finally {
      setBusyId(null);
    }
  };

  if (tags.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center gap-2 py-16 text-center">
        <Nfc className="text-white/20" size={32} />
        <p className="text-sm text-white/50">Nenhum chaveiro NFC cadastrado ainda.</p>
        <p className="text-xs text-white/30">Importe uma planilha ou adicione uma tag manualmente.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/5 bg-base-800/50 text-xs uppercase tracking-wide text-white/40">
            <tr>
              <th className="px-4 py-3 font-medium">Tag</th>
              <th className="px-4 py-3 font-medium">Modelo</th>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Título / Item</th>
              <th className="px-4 py-3 font-medium">{mainLinkLabel}</th>
              <th className="px-4 py-3 font-medium">{sacLinkLabel}</th>
              <th className="px-4 py-3 font-medium">{restrictedLinkLabel}</th>
              <th className="px-4 py-3 font-medium text-right">Scans</th>
              <th className="px-4 py-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {tags.map((tag) => {
              const isEditing = editingId === tag.id;
              const isBusy = busyId === tag.id;
              const hubUrl = `${publicBaseUrl}/nfc/${tag.tag_id}`;
              return (
                <React.Fragment key={tag.id}>
                  <tr className={isEditing ? 'bg-accent/5' : 'hover:bg-white/[0.02]'}>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-accent">
                      {tag.tag_id}
                    </td>
                    <td className="px-4 py-2.5"><ModelBadge tag={tag} /></td>
                    {isEditing ? (
                      <>
                        <td className="px-4 py-2.5"><EditableCell value={draft.itemCode} onChange={(v) => setDraft((d) => ({ ...d, itemCode: v }))} /></td>
                        <td className="px-4 py-2.5"><EditableCell value={draft.itemTitle} onChange={(v) => setDraft((d) => ({ ...d, itemTitle: v }))} /></td>
                        <td className="px-4 py-2.5"><EditableCell value={draft.mainLink} onChange={(v) => setDraft((d) => ({ ...d, mainLink: v }))} placeholder="https://..." /></td>
                        <td className="px-4 py-2.5"><EditableCell value={draft.sacLink} onChange={(v) => setDraft((d) => ({ ...d, sacLink: v }))} placeholder="https://..." /></td>
                        <td className="px-4 py-2.5"><EditableCell value={draft.restrictedLink} onChange={(v) => setDraft((d) => ({ ...d, restrictedLink: v }))} placeholder="https://..." /></td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2.5 text-white/60">{tag.item_code || '—'}</td>
                        <td className="px-4 py-2.5 text-white/90">{tag.item_title || '—'}</td>
                        <td className="max-w-[180px] truncate px-4 py-2.5 text-white/50">{tag.main_link || '—'}</td>
                        <td className="max-w-[140px] truncate px-4 py-2.5 text-white/50">{tag.sac_link || '—'}</td>
                        <td className="max-w-[140px] truncate px-4 py-2.5 text-white/50">{tag.restricted_link || '—'}</td>
                      </>
                    )}
                    <td className="px-4 py-2.5 text-right text-white/50">{tag.scan_count}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {isEditing ? (
                          <>
                            <button disabled={isBusy} onClick={() => saveEdit(tag.id)} className="rounded p-1.5 text-emerald-400 hover:bg-emerald-500/10" title="Salvar">
                              <Save size={15} />
                            </button>
                            <button disabled={isBusy} onClick={cancelEdit} className="rounded p-1.5 text-white/40 hover:bg-white/5" title="Cancelar">
                              <X size={15} />
                            </button>
                          </>
                        ) : (
                          <>
                            <a
                              href={hubUrl}
                              target="_blank" rel="noreferrer"
                              className="rounded p-1.5 text-white/40 hover:bg-white/5 hover:text-accent"
                              title="Abrir página pública"
                            >
                              <ExternalLink size={15} />
                            </a>
                            <button onClick={() => startEdit(tag)} className="rounded p-1.5 text-white/40 hover:bg-white/5 hover:text-white" title="Editar">
                              <Pencil size={15} />
                            </button>
                            <button disabled={isBusy} onClick={() => remove(tag.id)} className="rounded p-1.5 text-white/40 hover:bg-red-500/10 hover:text-red-400" title="Remover">
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {isEditing && (
                    <tr className="bg-accent/5">
                      <td colSpan={9} className="px-4 pb-4">
                        <NfcCapacityPanel
                          hubUrl={hubUrl}
                          model={draft.nfcModel} onModelChange={(v) => setDraft((d) => ({ ...d, nfcModel: v }))}
                          writeMode={draft.writeMode} onWriteModeChange={(v) => setDraft((d) => ({ ...d, writeMode: v }))}
                          customCapacityBytes={draft.customCapacityBytes}
                          onCustomCapacityChange={(v) => setDraft((d) => ({ ...d, customCapacityBytes: v }))}
                          links={{ mainLink: draft.mainLink, sacLink: draft.sacLink, restrictedLink: draft.restrictedLink }}
                          selectedLinks={draft.directLinksSelected} onToggleLink={toggleDraftLink}
                          linkLabels={{ mainLink: mainLinkLabel, sacLink: sacLinkLabel, restrictedLink: restrictedLinkLabel }}
                        />
                        {saveError && <p className="mt-2 text-xs text-red-400">{saveError}</p>}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
