import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenantScope } from '../middleware/tenant.js';
import { NFC_MODELS, validateTagCapacity } from '../utils/nfcCapacity.js';

const router = Router();
router.use(requireAuth, resolveTenantScope);

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://nfc.curalabs3d.com.br';
const VALID_MODELS = Object.keys(NFC_MODELS);
const VALID_LINK_KEYS = ['mainLink', 'sacLink', 'restrictedLink'];

function tagsQuery(tenantScope) {
  if (tenantScope) {
    return {
      sql: 'SELECT * FROM nfc_tags WHERE tenant_id = ? ORDER BY created_at DESC',
      params: [tenantScope],
    };
  }
  // SUPER_ADMIN sem filtro: vê tudo (uso administrativo/relatórios)
  return { sql: 'SELECT * FROM nfc_tags ORDER BY created_at DESC', params: [] };
}

// Serializa a linha do banco (snake_case + JSON string) para o formato usado pelo frontend
function serializeTag(row) {
  let directLinksSelected = [];
  try { directLinksSelected = JSON.parse(row.direct_links_selected || '[]'); } catch { /* ignore */ }

  const hubUrl = `${PUBLIC_BASE_URL}/nfc/${row.tag_id}`;
  const capacity = validateTagCapacity({
    model: row.nfc_model,
    customCapacityBytes: row.custom_capacity_bytes,
    writeMode: row.write_mode,
    hubUrl,
    links: { mainLink: row.main_link, sacLink: row.sac_link, restrictedLink: row.restricted_link },
    selectedLinks: directLinksSelected,
  });

  return { ...row, direct_links_selected: directLinksSelected, capacity };
}

function normalizeSelectedLinks(input) {
  if (!Array.isArray(input)) return [];
  return input.filter((key) => VALID_LINK_KEYS.includes(key));
}

// GET /api/tags/models — modelos de tag NFC disponíveis e suas capacidades
router.get('/models', (req, res) => {
  res.json({ models: NFC_MODELS });
});

// GET /api/tags
router.get('/', (req, res) => {
  const { sql, params } = tagsQuery(req.tenantScope);
  const rows = db.prepare(sql).all(...params);
  res.json({ tags: rows.map(serializeTag) });
});

// POST /api/tags  — criação individual
router.post('/', (req, res) => {
  const tenantId = req.tenantScope || req.body.tenantId;
  if (!tenantId) return res.status(400).json({ error: 'tenantId é obrigatório.' });

  const {
    tagId, itemCode, itemTitle, mainLink, sacLink, restrictedLink, photoUrl,
    nfcModel, writeMode, customCapacityBytes, directLinksSelected,
  } = req.body;

  if (!tagId) return res.status(400).json({ error: 'tagId é obrigatório (ex: TAG-001).' });

  const model = VALID_MODELS.includes(nfcModel) ? nfcModel : 'NTAG213';
  const mode = writeMode === 'DIRECT' ? 'DIRECT' : 'HUB';
  const selectedLinks = normalizeSelectedLinks(directLinksSelected);

  // Validação de capacidade antes de gravar — evita salvar uma configuração
  // que fisicamente não caberia no chip escolhido.
  const capacity = validateTagCapacity({
    model, customCapacityBytes, writeMode: mode,
    hubUrl: `${PUBLIC_BASE_URL}/nfc/${tagId.trim()}`,
    links: { mainLink, sacLink, restrictedLink },
    selectedLinks,
  });

  if (!capacity.fits) {
    return res.status(422).json({
      error: `A configuração escolhida não cabe no modelo ${NFC_MODELS[model]?.label || model} (${capacity.bytesUsed} bytes usados de ${capacity.capacityBytes} disponíveis). Desmarque algum link ou escolha um modelo com mais memória.`,
      capacity,
    });
  }

  const id = nanoid();
  try {
    db.prepare(`
      INSERT INTO nfc_tags (
        id, tenant_id, tag_id, item_code, item_title, main_link, sac_link, restricted_link, photo_url,
        nfc_model, write_mode, custom_capacity_bytes, direct_links_selected
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, tenantId, tagId.trim(), itemCode || null, itemTitle || null,
      mainLink || null, sacLink || null, restrictedLink || null, photoUrl || null,
      model, mode, model === 'CUSTOM' ? (customCapacityBytes || null) : null, JSON.stringify(selectedLinks)
    );
  } catch (err) {
    if (String(err).includes('UNIQUE')) {
      return res.status(409).json({ error: `A tag "${tagId}" já existe para esta empresa.` });
    }
    throw err;
  }

  const created = db.prepare('SELECT * FROM nfc_tags WHERE id = ?').get(id);
  res.status(201).json({ tag: serializeTag(created) });
});

// POST /api/tags/bulk-import
// Recebe o array já parseado pelo SheetJS no frontend e faz upsert em massa.
// Formato esperado de cada linha:
// { ID_TAG, Codigo_Item, Titulo_Item, Link_Principal, Link_SAC, Link_AreaRestrita, Foto_URL,
//   Modelo_NFC?, Modo_Gravacao? }
// Modelo_NFC e Modo_Gravacao são opcionais; quando ausentes, assume NTAG213 + modo Hub
// (que na prática nunca estoura, já que a URL do hub é sempre curta).
router.post('/bulk-import', (req, res) => {
  const tenantId = req.tenantScope || req.body.tenantId;
  if (!tenantId) return res.status(400).json({ error: 'tenantId é obrigatório.' });

  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (rows.length === 0) return res.status(400).json({ error: 'Nenhuma linha para importar.' });

  const upsert = db.prepare(`
    INSERT INTO nfc_tags (
      id, tenant_id, tag_id, item_code, item_title, main_link, sac_link, restricted_link, photo_url,
      nfc_model, write_mode, direct_links_selected
    )
    VALUES (@id, @tenantId, @tagId, @itemCode, @itemTitle, @mainLink, @sacLink, @restrictedLink, @photoUrl,
      @nfcModel, @writeMode, @directLinksSelected)
    ON CONFLICT(tenant_id, tag_id) DO UPDATE SET
      item_code = excluded.item_code,
      item_title = excluded.item_title,
      main_link = excluded.main_link,
      sac_link = excluded.sac_link,
      restricted_link = excluded.restricted_link,
      photo_url = excluded.photo_url,
      nfc_model = excluded.nfc_model,
      write_mode = excluded.write_mode,
      direct_links_selected = excluded.direct_links_selected,
      updated_at = datetime('now')
  `);

  let created = 0, updated = 0, skipped = 0;
  const errors = [];
  const warnings = [];

  const tx = db.transaction(() => {
    for (const [index, row] of rows.entries()) {
      const tagId = (row.ID_TAG || row.tagId || '').toString().trim();
      if (!tagId) {
        skipped++;
        errors.push(`Linha ${index + 2}: ID_TAG ausente, linha ignorada.`);
        continue;
      }

      const rawModel = (row.Modelo_NFC || row.nfcModel || 'NTAG213').toString().trim().toUpperCase();
      const model = VALID_MODELS.includes(rawModel) ? rawModel : 'NTAG213';
      const rawMode = (row.Modo_Gravacao || row.writeMode || 'HUB').toString().trim().toUpperCase();
      const mode = rawMode === 'DIRECT' || rawMode === 'DIRETO' ? 'DIRECT' : 'HUB';

      const mainLink = row.Link_Principal || row.mainLink || null;
      const sacLink = row.Link_SAC || row.sacLink || null;
      const restrictedLink = row.Link_AreaRestrita || row.restrictedLink || null;

      // No modo direto via planilha, considera "selecionado" todo link que veio preenchido.
      const selectedLinks = mode === 'DIRECT'
        ? VALID_LINK_KEYS.filter((key) => ({ mainLink, sacLink, restrictedLink }[key]))
        : [];

      const capacity = validateTagCapacity({
        model, writeMode: mode,
        hubUrl: `${PUBLIC_BASE_URL}/nfc/${tagId}`,
        links: { mainLink, sacLink, restrictedLink },
        selectedLinks,
      });

      if (!capacity.fits) {
        warnings.push(
          `Linha ${index + 2} (${tagId}): não cabe no ${NFC_MODELS[model]?.label} em modo ${mode === 'DIRECT' ? 'Direto' : 'Hub'} ` +
          `(${capacity.bytesUsed}/${capacity.capacityBytes} bytes). Linha importada mesmo assim — ajuste o modelo ou os links selecionados.`
        );
      }

      const existing = db.prepare('SELECT id FROM nfc_tags WHERE tenant_id = ? AND tag_id = ?').get(tenantId, tagId);

      upsert.run({
        id: existing?.id || nanoid(),
        tenantId,
        tagId,
        itemCode: row.Codigo_Item || row.itemCode || null,
        itemTitle: row.Titulo_Item || row.itemTitle || null,
        mainLink, sacLink, restrictedLink,
        photoUrl: row.Foto_URL || row.photoUrl || null,
        nfcModel: model,
        writeMode: mode,
        directLinksSelected: JSON.stringify(selectedLinks),
      });

      if (existing) updated++; else created++;
    }
  });
  tx();

  res.json({ message: 'Importação concluída.', created, updated, skipped, errors, warnings });
});

// PUT /api/tags/:id — edição rápida individual
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM nfc_tags WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Tag não encontrada.' });

  if (req.tenantScope && existing.tenant_id !== req.tenantScope) {
    return res.status(403).json({ error: 'Esta tag pertence a outra empresa.' });
  }

  const {
    itemCode, itemTitle, mainLink, sacLink, restrictedLink, photoUrl, isActive,
    nfcModel, writeMode, customCapacityBytes, directLinksSelected,
  } = req.body;

  const model = nfcModel !== undefined
    ? (VALID_MODELS.includes(nfcModel) ? nfcModel : existing.nfc_model)
    : existing.nfc_model;
  const mode = writeMode !== undefined
    ? (writeMode === 'DIRECT' ? 'DIRECT' : 'HUB')
    : existing.write_mode;
  const selectedLinks = directLinksSelected !== undefined
    ? normalizeSelectedLinks(directLinksSelected)
    : JSON.parse(existing.direct_links_selected || '[]');
  const capacityBytesOverride = customCapacityBytes !== undefined ? customCapacityBytes : existing.custom_capacity_bytes;

  const finalMainLink = mainLink ?? existing.main_link;
  const finalSacLink = sacLink ?? existing.sac_link;
  const finalRestrictedLink = restrictedLink ?? existing.restricted_link;

  const capacity = validateTagCapacity({
    model, customCapacityBytes: capacityBytesOverride, writeMode: mode,
    hubUrl: `${PUBLIC_BASE_URL}/nfc/${existing.tag_id}`,
    links: { mainLink: finalMainLink, sacLink: finalSacLink, restrictedLink: finalRestrictedLink },
    selectedLinks,
  });

  if (!capacity.fits) {
    return res.status(422).json({
      error: `A configuração escolhida não cabe no modelo ${NFC_MODELS[model]?.label || model} (${capacity.bytesUsed} bytes usados de ${capacity.capacityBytes} disponíveis). Desmarque algum link ou escolha um modelo com mais memória.`,
      capacity,
    });
  }

  db.prepare(`
    UPDATE nfc_tags SET
      item_code = ?, item_title = ?, main_link = ?, sac_link = ?, restricted_link = ?,
      photo_url = ?, is_active = ?, nfc_model = ?, write_mode = ?, custom_capacity_bytes = ?,
      direct_links_selected = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    itemCode ?? existing.item_code,
    itemTitle ?? existing.item_title,
    finalMainLink, finalSacLink, finalRestrictedLink,
    photoUrl ?? existing.photo_url,
    isActive === undefined ? existing.is_active : (isActive ? 1 : 0),
    model, mode, model === 'CUSTOM' ? capacityBytesOverride : null,
    JSON.stringify(selectedLinks),
    existing.id
  );

  const updated = db.prepare('SELECT * FROM nfc_tags WHERE id = ?').get(existing.id);
  res.json({ tag: serializeTag(updated) });
});

// DELETE /api/tags/:id
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM nfc_tags WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Tag não encontrada.' });

  if (req.tenantScope && existing.tenant_id !== req.tenantScope) {
    return res.status(403).json({ error: 'Esta tag pertence a outra empresa.' });
  }

  db.prepare('DELETE FROM nfc_tags WHERE id = ?').run(existing.id);
  res.json({ message: 'Tag removida.' });
});

// GET /api/tags/export-batch — gera lista de payloads para gravação em lote no NFC Tools.
// No modo Hub, o payload é a URL curta do hub (o caso normal, recomendado para gravação
// cíclica em massa). No modo Direto, informamos o link efetivamente gravado (apenas o
// primeiro link selecionado é usado como payload principal — gravação de múltiplos
// registros por chip não é bem suportada pelo modo de escrita em lote do NFC Tools).
router.get('/export-batch', (req, res) => {
  const { sql, params } = tagsQuery(req.tenantScope);
  const rows = db.prepare(sql).all(...params);

  const lines = rows.map((t) => {
    const hubUrl = `${PUBLIC_BASE_URL}/nfc/${t.tag_id}`;
    if (t.write_mode !== 'DIRECT') {
      return `${t.tag_id},HUB,${t.nfc_model},${hubUrl}`;
    }
    let selected = [];
    try { selected = JSON.parse(t.direct_links_selected || '[]'); } catch { /* ignore */ }
    const linkMap = { mainLink: t.main_link, sacLink: t.sac_link, restrictedLink: t.restricted_link };
    const primary = selected.map((key) => linkMap[key]).find(Boolean) || hubUrl;
    return `${t.tag_id},DIRECT,${t.nfc_model},${primary}`;
  });

  const csv = ['tag_id,modo,modelo,payload', ...lines].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="lote-urls-nfc.csv"');
  res.send(csv);
});

export default router;
