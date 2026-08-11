import { Router } from 'express';
import { db } from '../db/index.js';

const router = Router();

// GET /api/public/nfc/:tagId
// Rota pública (sem autenticação), acionada quando o cliente final aproxima
// o chaveiro NFC do smartphone. Não expõe nenhum dado sensível de outros tenants.
router.get('/nfc/:tagId', (req, res) => {
  const tagId = req.params.tagId.trim();

  const tag = db.prepare('SELECT * FROM nfc_tags WHERE tag_id = ? AND is_active = 1').get(tagId);
  if (!tag) {
    return res.status(404).json({ error: 'Chaveiro NFC não encontrado ou inativo.' });
  }

  const tenant = db.prepare('SELECT id, name, slug, logo_url, status FROM tenants WHERE id = ?').get(tag.tenant_id);
  if (!tenant || tenant.status !== 'ACTIVE') {
    return res.status(404).json({ error: 'Empresa associada a este chaveiro está inativa.' });
  }

  // Contabiliza o "scan" de forma assíncrona/best-effort
  db.prepare('UPDATE nfc_tags SET scan_count = scan_count + 1 WHERE id = ?').run(tag.id);

  res.json({
    tag: {
      tagId: tag.tag_id,
      itemCode: tag.item_code,
      itemTitle: tag.item_title,
      mainLink: tag.main_link,
      sacLink: tag.sac_link,
      restrictedLink: tag.restricted_link,
      photoUrl: tag.photo_url,
    },
    company: {
      name: tenant.name,
      logoUrl: tenant.logo_url,
    },
  });
});

export default router;
