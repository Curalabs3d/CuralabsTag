import React, { useCallback, useState } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Download, Loader2 } from 'lucide-react';
import { parseExcelFile, downloadTemplate } from '../utils/excelParser.js';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function ExcelUploader({ onImported }) {
  const { token } = useAuth();
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFile = useCallback(async (file) => {
    setError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const { rows } = await parseExcelFile(file);
      setPreview(rows);
    } catch (err) {
      setPreview(null);
      setError(err.message);
    }
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const confirmImport = async () => {
    if (!preview) return;
    setImporting(true);
    setError(null);
    try {
      const data = await api.bulkImportTags(token, preview);
      setResult(data);
      onImported?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFileName(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-semibold text-white">Importar planilha</h3>
          <p className="mt-0.5 text-xs text-white/40">
            Colunas: ID_TAG, Codigo_Item, Titulo_Item, Link_Principal, Link_SAC, Link_AreaRestrita, Foto_URL
          </p>
          <p className="mt-0.5 text-xs text-white/30">
            Opcional: Modelo_NFC (NTAG213/215/216) e Modo_Gravacao (HUB/DIRETO) — se ausentes, assume NTAG213 + Hub
          </p>
        </div>
        <button onClick={downloadTemplate} className="btn-secondary !py-2 !px-3 text-xs">
          <Download size={14} /> Baixar modelo
        </button>
      </div>

      {!preview && !result && (
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-10 text-center transition-colors
            ${dragging ? 'border-accent bg-accent/5' : 'border-white/10 hover:border-white/20'}`}
        >
          <UploadCloud className={dragging ? 'text-accent' : 'text-white/30'} size={28} />
          <p className="text-sm text-white/70">
            Arraste o arquivo <span className="text-white">.xlsx</span> ou <span className="text-white">.csv</span> aqui
          </p>
          <p className="text-xs text-white/30">ou clique para selecionar</p>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onInputChange} />
        </label>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {preview && !result && (
        <div className="mt-4">
          <div className="mb-3 flex items-center gap-2 text-sm text-white/70">
            <FileSpreadsheet size={16} className="text-accent" />
            <span className="truncate">{fileName}</span>
            <span className="text-white/30">· {preview.length} linha(s) encontrada(s)</span>
          </div>

          <div className="max-h-64 overflow-auto rounded-lg border border-white/5">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-base-800 text-white/50">
                <tr>
                  <th className="px-3 py-2 font-medium">ID_TAG</th>
                  <th className="px-3 py-2 font-medium">Codigo_Item</th>
                  <th className="px-3 py-2 font-medium">Titulo_Item</th>
                  <th className="px-3 py-2 font-medium">Link_Principal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {preview.slice(0, 8).map((row, i) => (
                  <tr key={i} className="text-white/70">
                    <td className="px-3 py-2 font-mono">{row.ID_TAG}</td>
                    <td className="px-3 py-2">{row.Codigo_Item}</td>
                    <td className="px-3 py-2">{row.Titulo_Item}</td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-accent/80">{row.Link_Principal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.length > 8 && (
            <p className="mt-2 text-xs text-white/30">+ {preview.length - 8} linha(s) adicionais não exibidas no preview.</p>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button onClick={confirmImport} disabled={importing} className="btn-primary">
              {importing ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              {importing ? 'Importando...' : `Confirmar importação (${preview.length})`}
            </button>
            <button onClick={reset} className="btn-secondary" disabled={importing}>Cancelar</button>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 size={18} />
            <span className="font-display text-sm font-semibold">Importação concluída</span>
          </div>
          <p className="mt-1 text-sm text-white/70">
            {result.created} criada(s) · {result.updated} atualizada(s) · {result.skipped} ignorada(s)
          </p>
          {result.errors?.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-amber-300/80">
              {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          {result.warnings?.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-300">
                <AlertTriangle size={13} /> Avisos de capacidade ({result.warnings.length})
              </p>
              <ul className="list-inside list-disc space-y-0.5 text-xs text-amber-300/70">
                {result.warnings.slice(0, 8).map((w, i) => <li key={i}>{w}</li>)}
              </ul>
              {result.warnings.length > 8 && (
                <p className="mt-1 text-xs text-amber-300/50">+ {result.warnings.length - 8} aviso(s) adicionais.</p>
              )}
            </div>
          )}
          <button onClick={reset} className="btn-secondary mt-3 !py-2 !px-3 text-xs">Importar outro arquivo</button>
        </div>
      )}
    </div>
  );
}
