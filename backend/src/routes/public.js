import { Router } from 'express';
import { withTenantContext } from '../db/index.js';

const router = Router();

const asPublicLookup = (callback) => withTenantContext({ tenantId: null, role: 'PUBLIC_LOOKUP' }, callback);

// GET /api/public/nfc/:tagId
// Rota pública (sem autenticação), acionada quando o cliente final aproxima
// o chaveiro NFC do smartphone.
router.get('/nfc/:tagId', async (req, res, next) => {
  try {
    const tagId = req.params.tagId.trim();

    const result = await asPublicLookup(async (client) => {
      const { rows: tagRows } = await client.query(
        'SELECT * FROM nfc_tags WHERE tag_id = $1 AND is_active = true', [tagId]
      );
      const tag = tagRows[0];
      if (!tag) return { notFound: true };

      const { rows: tenantRows } = await client.query(
        'SELECT id, name, slug, logo_url, brand_color, background_color, welcome_message, status FROM tenants WHERE id = $1', [tag.tenant_id]
      );
      const tenant = tenantRows[0];
      if (!tenant || tenant.status !== 'ACTIVE') return { notFound: true };

      await client.query('UPDATE nfc_tags SET scan_count = scan_count + 1 WHERE id = $1', [tag.id]);

      return { tag, tenant };
    });

    if (result.notFound) {
      return res.status(404).json({ error: 'Chaveiro NFC não encontrado ou inativo.' });
    }

    const { tag, tenant } = result;
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
      company: { name: tenant.name, logoUrl: tenant.logo_url, brandColor: tenant.brand_color, backgroundColor: tenant.background_color, welcomeMessage: tenant.welcome_message },
    });
  } catch (err) { next(err); }
});

export default router;
