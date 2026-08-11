import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Nfc, ScanLine, Download, Loader2 } from 'lucide-react';
import AppShell from '../components/AppShell.jsx';
import ExcelUploader from '../components/ExcelUploader.jsx';
import TagsTable from '../components/TagsTable.jsx';
import NfcCapacityPanel from '../components/NfcCapacityPanel.jsx';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const PUBLIC_BASE_URL = import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className="rounded-lg bg-accent/10 p-2.5 text-accent">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-lg font-semibold leading-none text-white">{value}</p>
        <p className="mt-1 text-xs text-white/40">{label}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { token } = useAuth();
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('table'); // table | import
  const [exporting, setExporting] = useState(false);
  const [newTagOpen, setNewTagOpen] = useState(false);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const { tags } = await api.listTags(token);
      setTags(tags);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  const totalScans = tags.reduce((sum, t) => sum + (t.scan_count || 0), 0);

  const exportBatch = async () => {
    setExporting(true);
    try {
      const blob = await api.exportBatchCsv(token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lote-urls-nfc.csv';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell
      title="Painel de Chaveiros NFC"
      subtitle="Gerencie os links de cada chaveiro NFC da sua empresa."
      actions={
        <>
          <button onClick={exportBatch} disabled={exporting || tags.length === 0} className="btn-secondary">
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Exportar lote (URLs)
          </button>
          <button onClick={() => setNewTagOpen(true)} className="btn-primary">
            <Plus size={16} /> Nova tag
          </button>
        </>
      }
    >
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Nfc} label="Chaveiros cadastrados" value={tags.length} />
        <StatCard icon={ScanLine} label="Total de acessos (scans)" value={totalScans} />
        <StatCard icon={Nfc} label="Chaveiros ativos" value={tags.filter((t) => t.is_active).length} />
      </div>

      <div className="mb-4 flex items-center gap-1 border-b border-white/5">
        {[
          { id: 'table', label: 'Tabela de Tags' },
          { id: 'import', label: 'Importar Excel/CSV' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px
              ${tab === t.id ? 'border-accent text-white' : 'border-transparent text-white/40 hover:text-white/70'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'table' && (
        loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div>
        ) : (
          <TagsTable tags={tags} onChange={fetchTags} publicBaseUrl={PUBLIC_BASE_URL} />
        )
      )}

      {tab === 'import' && <ExcelUploader onImported={fetchTags} />}

      {newTagOpen && <NewTagModal onClose={() => setNewTagOpen(false)} onCreated={fetchTags} />}
    </AppShell>
  );
}

// Lembra a última combinação modelo/modo escolhida pelo usuário neste
// navegador, para pré-preencher a próxima tag criada — evita ter que
// reselecionar o mesmo modelo (ex: NTAG213) a cada chaveiro cadastrado.
const LAST_CONFIG_KEY = 'curalabs3d_last_nfc_config';

function loadLastNfcConfig() {
  try {
    const raw = localStorage.getItem(LAST_CONFIG_KEY);
    if (!raw) return { nfcModel: 'NTAG213', writeMode: 'HUB', customCapacityBytes: 144 };
    const parsed = JSON.parse(raw);
    return {
      nfcModel: parsed.nfcModel || 'NTAG213',
      writeMode: parsed.writeMode || 'HUB',
      customCapacityBytes: parsed.customCapacityBytes || 144,
    };
  } catch {
    return { nfcModel: 'NTAG213', writeMode: 'HUB', customCapacityBytes: 144 };
  }
}

function saveLastNfcConfig(config) {
  try {
    localStorage.setItem(LAST_CONFIG_KEY, JSON.stringify(config));
  } catch { /* localStorage indisponível — segue sem lembrar, sem quebrar o fluxo */ }
}

function NewTagModal({ onClose, onCreated }) {
  const { token } = useAuth();
  const [form, setForm] = useState({ tagId: '', itemCode: '', itemTitle: '', mainLink: '', sacLink: '', restrictedLink: '' });
  const lastConfig = loadLastNfcConfig();
  const [nfcModel, setNfcModel] = useState(lastConfig.nfcModel);
  const [writeMode, setWriteMode] = useState(lastConfig.writeMode);
  const [customCapacityBytes, setCustomCapacityBytes] = useState(lastConfig.customCapacityBytes);
  const [selectedLinks, setSelectedLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const toggleLink = (key) => {
    setSelectedLinks((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };

  const hubUrl = `${PUBLIC_BASE_URL}/nfc/${form.tagId || 'TAG-XXX'}`;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.createTag(token, {
        ...form,
        nfcModel, writeMode, customCapacityBytes,
        directLinksSelected: writeMode === 'DIRECT' ? selectedLinks : [],
      });
      saveLastNfcConfig({ nfcModel, writeMode, customCapacityBytes });
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="card my-8 w-full max-w-md p-6">
        <h2 className="font-display text-lg font-semibold text-white">Nova tag NFC</h2>
        <div className="mt-4 space-y-3">
          <div>
            <label className="label-field">ID da Tag *</label>
            <input required value={form.tagId} onChange={update('tagId')} placeholder="TAG-004" className="input-field font-mono" />
          </div>
          <div>
            <label className="label-field">Código do item</label>
            <input value={form.itemCode} onChange={update('itemCode')} className="input-field" />
          </div>
          <div>
            <label className="label-field">Título / Item</label>
            <input value={form.itemTitle} onChange={update('itemTitle')} className="input-field" />
          </div>
          <div>
            <label className="label-field">Link principal</label>
            <input value={form.mainLink} onChange={update('mainLink')} className="input-field" placeholder="https://..." />
          </div>
          <div>
            <label className="label-field">Link SAC</label>
            <input value={form.sacLink} onChange={update('sacLink')} className="input-field" placeholder="https://..." />
          </div>
          <div>
            <label className="label-field">Link área restrita</label>
            <input value={form.restrictedLink} onChange={update('restrictedLink')} className="input-field" placeholder="https://..." />
          </div>
        </div>

        <div className="mt-4">
          <NfcCapacityPanel
            hubUrl={hubUrl}
            model={nfcModel} onModelChange={setNfcModel}
            writeMode={writeMode} onWriteModeChange={setWriteMode}
            customCapacityBytes={customCapacityBytes} onCustomCapacityChange={setCustomCapacityBytes}
            links={{ mainLink: form.mainLink, sacLink: form.sacLink, restrictedLink: form.restrictedLink }}
            selectedLinks={selectedLinks} onToggleLink={toggleLink}
          />
          <p className="mt-2 text-[11px] text-white/25">
            Modelo e modo de gravação ficam salvos para a próxima tag — só mude quando precisar.
          </p>
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Criar tag'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
        </div>
      </form>
    </div>
  );
}
