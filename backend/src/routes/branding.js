import { Router } from 'express';
import { withTenantContext } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { resolveTenantScope } from '../middleware/tenant.js';

const router = Router();

// Apenas TENANT_ADMIN edita a própria marca (não faz sentido para TENANT_USER
// nem para SUPER_ADMIN, que não tem uma "própria" empresa).
router.use(requireAuth, requireRole('TENANT_ADMIN'), resolveTenantScope);

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

// GET /api/branding — marca atual do tenant logado
router.get('/', async (req, res, next) => {
  try {
    const tenant = await withTenantContext(req.tenantContext, async (client) => {
      const { rows } = await client.query(
        'SELECT id, name, logo_url, brand_color, welcome_message FROM tenants WHERE id = $1',
        [req.tenantScope]
      );
      return rows[0];
    });
    if (!tenant) return res.status(404).json({ error: 'Empresa não encontrada.' });
    res.json({ branding: tenant });
  } catch (err) { next(err); }
});

// PUT /api/branding — atualiza logo, cor de destaque e mensagem de boas-vindas
router.put('/', async (req, res, next) => {
  try {
    const { logoUrl, brandColor, welcomeMessage } = req.body;

    if (brandColor && !HEX_COLOR_REGEX.test(brandColor)) {
      return res.status(400).json({ error: 'Cor inválida. Use o formato hexadecimal, ex: #FF5C00.' });
    }
    if (welcomeMessage && welcomeMessage.length > 160) {
      return res.status(400).json({ error: 'Mensagem de boas-vindas deve ter até 160 caracteres.' });
    }

    const tenant = await withTenantContext(req.tenantContext, async (client) => {
      const { rows: existingRows } = await client.query('SELECT * FROM tenants WHERE id = $1', [req.tenantScope]);
      const existing = existingRows[0];
      if (!existing) return null;

      await client.query(
        `UPDATE tenants SET logo_url = $1, brand_color = $2, welcome_message = $3 WHERE id = $4`,
        [
          logoUrl !== undefined ? (logoUrl || null) : existing.logo_url,
          brandColor !== undefined ? (brandColor || null) : existing.brand_color,
          welcomeMessage !== undefined ? (welcomeMessage || null) : existing.welcome_message,
          existing.id,
        ]
      );
      const { rows } = await client.query(
        'SELECT id, name, logo_url, brand_color, welcome_message FROM tenants WHERE id = $1',
        [existing.id]
      );
      return rows[0];
    });

    if (!tenant) return res.status(404).json({ error: 'Empresa não encontrada.' });
    res.json({ branding: tenant });
  } catch (err) { next(err); }
});

export default router;
