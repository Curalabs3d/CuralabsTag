import { Router } from 'express';
import { nanoid } from 'nanoid';
import { withTenantContext } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenantScope } from '../middleware/tenant.js';
import { requireModule, getTenantPlanInfo, blockIfPastDueBeyondGracePeriod } from '../middleware/modules.js';
import { NFC_MODELS, validateTagCapacity } from '../utils/nfcCapacity.js';

const router = Router();
router.use(requireAuth, resolveTenantScope, blockIfPastDueBeyondGracePeriod());

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://nfc.curalabs3d.com.br';
const VALID_MODELS = Object.keys(NFC_MODELS);
const VALID_LINK_KEYS = ['mainLink', 'sacLink', 'restrictedLink'];

function serializeTag(row) {
  const directLinksSelected = Array.isArray(row.direct_links_selected) ? row.direct_links_selected : [];
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

// GET /api/tags/models — não depende de banco, pode responder direto
router.get('/models', (req, res) => {
  res.json({ models: NFC_MODELS });
});

// GET /api/tags
router.get('/', async (req, res, next) => {
  try {
    const rows = await withTenantContext(req.tenantContext, async (client) => {
      const { rows } = req.tenantScope
        ? await client.query('SELECT * FROM nfc_tags WHERE tenant_id = $1 ORDER BY created_at DESC', [req.tenantScope])
        : await client.query('SELECT * FROM nfc_tags ORDER BY created_at DESC');
      return rows;
    });
    res.json({ tags: rows.map(serializeTag) });
  } catch (err) { next(err); }
});

// POST /api/tags — criação individual
router.post('/', async (req, res, next) => {
  try {
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
      const created = await withTenantContext(req.tenantContext, async (client) => {
        if (req.user.role !== 'SUPER_ADMIN') {
          const { tagLimit } = await getTenantPlanInfo(client, tenantId);
          if (tagLimit !== null) {
            const { rows: countRows } = await client.query('SELECT COUNT(*)::int AS c FROM nfc_tags WHERE tenant_id = $1', [tenantId]);
            if (countRows[0].c >= tagLimit) {
              const err = new Error(`Seu plano permite até ${tagLimit} tags. Faça upgrade para cadastrar mais.`);
              err.statusCode = 403;
              throw err;
            }
          }
        }

        await client.query(
          `INSERT INTO nfc_tags (
            id, tenant_id, tag_id, item_code, item_title, main_link, sac_link, restricted_link, photo_url,
            nfc_model, write_mode, custom_capacity_bytes, direct_links_selected
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            id, tenantId, tagId.trim(), itemCode || null, itemTitle || null,
            mainLink || null, sacLink || null, restrictedLink || null, photoUrl || null,
            model, mode, model === 'CUSTOM' ? (customCapacityBytes || null) : null, JSON.stringify(selectedLinks),
          ]
        );
        const { rows } = await client.query('SELECT * FROM nfc_tags WHERE id = $1', [id]);
        return rows[0];
      });
      res.status(201).json({ tag: serializeTag(created) });
    } catch (err) {
      if (err.statusCode === 403) {
        return res.status(403).json({ error: err.message });
      }
      if (err.code === '23505') { // unique_violation
        return res.status(409).json({ error: `O código "${tagId}" já está em uso — cada tag precisa de um código único em todo o sistema, mesmo entre empresas diferentes.` });
      }
      throw err;
    }
  } catch (err) { next(err); }
});

// POST /api/tags/bulk-import
router.post('/bulk-import', requireModule('bulk_import'), async (req, res, next) => {
  try {
    const tenantId = req.tenantScope || req.body.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenantId é obrigatório.' });

    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (rows.length === 0) return res.status(400).json({ error: 'Nenhuma linha para importar.' });

    let created = 0, updated = 0, skipped = 0;
    const errors = [];
    const warnings = [];

    await withTenantContext(req.tenantContext, async (client) => {
      if (req.user.role !== 'SUPER_ADMIN') {
        const { tagLimit } = await getTenantPlanInfo(client, tenantId);
        if (tagLimit !== null) {
          const { rows: existingIds } = await client.query('SELECT tag_id FROM nfc_tags WHERE tenant_id = $1', [tenantId]);
          const existingSet = new Set(existingIds.map((r) => r.tag_id));
          const incomingIds = new Set(
            rows.map((r) => (r.ID_TAG || r.tagId || '').toString().trim()).filter(Boolean)
          );
          const newCount = [...incomingIds].filter((id) => !existingSet.has(id)).length;
          const projectedTotal = existingSet.size + newCount;
          if (projectedTotal > tagLimit) {
            const err = new Error(
              `Essa importação levaria a empresa a ${projectedTotal} tags, mas o plano atual permite até ${tagLimit}. Faça upgrade ou reduza o lote.`
            );
            err.statusCode = 403;
            throw err;
          }
        }
      }

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

        const { rows: existingRows } = await client.query(
          'SELECT id, tenant_id FROM nfc_tags WHERE tag_id = $1', [tagId]
        );
        const existing = existingRows[0];

        // Como tag_id agora é único em todo o sistema (não só por empresa),
        // uma linha da planilha pode coincidir com uma tag que já pertence
        // a OUTRA empresa. Nesse caso, nunca sobrescrevemos — isso seria
        // sequestrar o cadastro de outro tenant. Reportamos como erro.
        if (existing && existing.tenant_id !== tenantId) {
          skipped++;
          errors.push(`Linha ${index + 2}: a tag "${tagId}" já está cadastrada em outra empresa. Escolha um código diferente.`);
          continue;
        }

        await client.query(
          `INSERT INTO nfc_tags (
             id, tenant_id, tag_id, item_code, item_title, main_link, sac_link, restricted_link, photo_url,
             nfc_model, write_mode, direct_links_selected
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (tag_id) DO UPDATE SET
             item_code = EXCLUDED.item_code,
             item_title = EXCLUDED.item_title,
             main_link = EXCLUDED.main_link,
             sac_link = EXCLUDED.sac_link,
             restricted_link = EXCLUDED.restricted_link,
             photo_url = EXCLUDED.photo_url,
             nfc_model = EXCLUDED.nfc_model,
             write_mode = EXCLUDED.write_mode,
             direct_links_selected = EXCLUDED.direct_links_selected,
             updated_at = now()`,
          [
            existing?.id || nanoid(), tenantId, tagId,
            row.Codigo_Item || row.itemCode || null, row.Titulo_Item || row.itemTitle || null,
            mainLink, sacLink, restrictedLink, row.Foto_URL || row.photoUrl || null,
            model, mode, JSON.stringify(selectedLinks),
          ]
        );

        if (existing) updated++; else created++;
      }
    });

    res.json({ message: 'Importação concluída.', created, updated, skipped, errors, warnings });
  } catch (err) {
    if (err.statusCode === 403) return res.status(403).json({ error: err.message });
    next(err);
  }
});

// PUT /api/tags/:id — edição rápida individual
router.put('/:id', async (req, res, next) => {
  try {
    const {
      itemCode, itemTitle, mainLink, sacLink, restrictedLink, photoUrl, isActive,
      nfcModel, writeMode, customCapacityBytes, directLinksSelected,
    } = req.body;

    const result = await withTenantContext(req.tenantContext, async (client) => {
      const { rows: existingRows } = await client.query('SELECT * FROM nfc_tags WHERE id = $1', [req.params.id]);
      const existing = existingRows[0];
      if (!existing) return { notFound: true };

      if (req.tenantScope && existing.tenant_id !== req.tenantScope) {
        return { forbidden: true };
      }

      const model = nfcModel !== undefined ? (VALID_MODELS.includes(nfcModel) ? nfcModel : existing.nfc_model) : existing.nfc_model;
      const mode = writeMode !== undefined ? (writeMode === 'DIRECT' ? 'DIRECT' : 'HUB') : existing.write_mode;
      const selectedLinks = directLinksSelected !== undefined
        ? normalizeSelectedLinks(directLinksSelected)
        : (Array.isArray(existing.direct_links_selected) ? existing.direct_links_selected : []);
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
        return {
          capacityError: `A configuração escolhida não cabe no modelo ${NFC_MODELS[model]?.label || model} (${capacity.bytesUsed} bytes usados de ${capacity.capacityBytes} disponíveis). Desmarque algum link ou escolha um modelo com mais memória.`,
          capacity,
        };
      }

      await client.query(
        `UPDATE nfc_tags SET
           item_code = $1, item_title = $2, main_link = $3, sac_link = $4, restricted_link = $5,
           photo_url = $6, is_active = $7, nfc_model = $8, write_mode = $9, custom_capacity_bytes = $10,
           direct_links_selected = $11, updated_at = now()
         WHERE id = $12`,
        [
          itemCode ?? existing.item_code, itemTitle ?? existing.item_title,
          finalMainLink, finalSacLink, finalRestrictedLink,
          photoUrl ?? existing.photo_url,
          isActive === undefined ? existing.is_active : !!isActive,
          model, mode, model === 'CUSTOM' ? capacityBytesOverride : null,
          JSON.stringify(selectedLinks), existing.id,
        ]
      );

      const { rows: updatedRows } = await client.query('SELECT * FROM nfc_tags WHERE id = $1', [existing.id]);
      return { tag: updatedRows[0] };
    });

    if (result.notFound) return res.status(404).json({ error: 'Tag não encontrada.' });
    if (result.forbidden) return res.status(403).json({ error: 'Esta tag pertence a outra empresa.' });
    if (result.capacityError) return res.status(422).json({ error: result.capacityError, capacity: result.capacity });

    res.json({ tag: serializeTag(result.tag) });
  } catch (err) { next(err); }
});

// DELETE /api/tags/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await withTenantContext(req.tenantContext, async (client) => {
      const { rows: existingRows } = await client.query('SELECT * FROM nfc_tags WHERE id = $1', [req.params.id]);
      const existing = existingRows[0];
      if (!existing) return { notFound: true };
      if (req.tenantScope && existing.tenant_id !== req.tenantScope) return { forbidden: true };

      await client.query('DELETE FROM nfc_tags WHERE id = $1', [existing.id]);
      return { ok: true };
    });

    if (result.notFound) return res.status(404).json({ error: 'Tag não encontrada.' });
    if (result.forbidden) return res.status(403).json({ error: 'Esta tag pertence a outra empresa.' });
    res.json({ message: 'Tag removida.' });
  } catch (err) { next(err); }
});

// GET /api/tags/export-batch
router.get('/export-batch', requireModule('batch_export'), async (req, res, next) => {
  try {
    const rows = await withTenantContext(req.tenantContext, async (client) => {
      const { rows } = req.tenantScope
        ? await client.query('SELECT * FROM nfc_tags WHERE tenant_id = $1 ORDER BY created_at DESC', [req.tenantScope])
        : await client.query('SELECT * FROM nfc_tags ORDER BY created_at DESC');
      return rows;
    });

    const lines = rows.map((t) => {
      const hubUrl = `${PUBLIC_BASE_URL}/nfc/${t.tag_id}`;
      if (t.write_mode !== 'DIRECT') {
        return `${t.tag_id},HUB,${t.nfc_model},${hubUrl}`;
      }
      const selected = Array.isArray(t.direct_links_selected) ? t.direct_links_selected : [];
      const linkMap = { mainLink: t.main_link, sacLink: t.sac_link, restrictedLink: t.restricted_link };
      const primary = selected.map((key) => linkMap[key]).find(Boolean) || hubUrl;
      return `${t.tag_id},DIRECT,${t.nfc_model},${primary}`;
    });

    const csv = ['tag_id,modo,modelo,payload', ...lines].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="lote-urls-nfc.csv"');
    res.send(csv);
  } catch (err) { next(err); }
});

export default router;
