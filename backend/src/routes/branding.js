import { Router } from 'express';
import { withTenantContext } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { resolveTenantScope } from '../middleware/tenant.js';
import { requireModule, blockIfPastDueBeyondGracePeriod } from '../middleware/modules.js';

const router = Router();

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const MAX_LABEL_LENGTH = 40;

const BRANDING_COLUMNS = `
  id, name, logo_url, brand_color, background_color, welcome_message,
  main_link_label, sac_link_label, restricted_link_label
`;

function validateLabel(value, fieldLabel) {
  if (value && value.length > MAX_LABEL_LENGTH) {
    return `${fieldLabel} deve ter até ${MAX_LABEL_LENGTH} caracteres.`;
  }
  return null;
}

// GET /api/branding — leitura liberada para TENANT_ADMIN e TENANT_USER
// (usado inclusive no formulário de criação de tag, para mostrar os
// rótulos de botão já customizados pela empresa, não só na tela de marca).
router.get(
  '/',
  requireAuth, requireRole('TENANT_ADMIN', 'TENANT_USER'), resolveTenantScope,
  async (req, res, next) => {
    try {
      const tenant = await withTenantContext(req.tenantContext, async (client) => {
        const { rows } = await client.query(
          `SELECT ${BRANDING_COLUMNS} FROM tenants WHERE id = $1`,
          [req.tenantScope]
        );
        return rows[0];
      });
      if (!tenant) return res.status(404).json({ error: 'Empresa não encontrada.' });
      res.json({ branding: tenant });
    } catch (err) { next(err); }
  }
);

// PUT /api/branding — só TENANT_ADMIN edita, e só se o módulo estiver no plano
router.put(
  '/',
  requireAuth, requireRole('TENANT_ADMIN'), resolveTenantScope, blockIfPastDueBeyondGracePeriod(), requireModule('branding'),
  async (req, res, next) => {
    try {
      const {
        name, logoUrl, brandColor, backgroundColor, welcomeMessage,
        mainLinkLabel, sacLinkLabel, restrictedLinkLabel,
      } = req.body;

      if (name !== undefined && !name.trim()) {
        return res.status(400).json({ error: 'O nome da empresa não pode ficar em branco.' });
      }
      if (name && name.trim().length > 120) {
        return res.status(400).json({ error: 'Nome da empresa deve ter até 120 caracteres.' });
      }
      if (brandColor && !HEX_COLOR_REGEX.test(brandColor)) {
        return res.status(400).json({ error: 'Cor de destaque inválida. Use o formato hexadecimal, ex: #FF5C00.' });
      }
      if (backgroundColor && !HEX_COLOR_REGEX.test(backgroundColor)) {
        return res.status(400).json({ error: 'Cor de fundo inválida. Use o formato hexadecimal, ex: #FFFFFF.' });
      }
      if (welcomeMessage && welcomeMessage.length > 160) {
        return res.status(400).json({ error: 'Mensagem de boas-vindas deve ter até 160 caracteres.' });
      }
      const labelError = validateLabel(mainLinkLabel, 'Rótulo do link principal')
        || validateLabel(sacLinkLabel, 'Rótulo do link de SAC')
        || validateLabel(restrictedLinkLabel, 'Rótulo do link de área restrita');
      if (labelError) return res.status(400).json({ error: labelError });

      const tenant = await withTenantContext(req.tenantContext, async (client) => {
        const { rows: existingRows } = await client.query('SELECT * FROM tenants WHERE id = $1', [req.tenantScope]);
        const existing = existingRows[0];
        if (!existing) return null;

        await client.query(
          `UPDATE tenants SET
             name = $1, logo_url = $2, brand_color = $3, background_color = $4, welcome_message = $5,
             main_link_label = $6, sac_link_label = $7, restricted_link_label = $8
           WHERE id = $9`,
          [
            name !== undefined ? name.trim() : existing.name,
            logoUrl !== undefined ? (logoUrl || null) : existing.logo_url,
            brandColor !== undefined ? (brandColor || null) : existing.brand_color,
            backgroundColor !== undefined ? (backgroundColor || null) : existing.background_color,
            welcomeMessage !== undefined ? (welcomeMessage || null) : existing.welcome_message,
            mainLinkLabel !== undefined ? (mainLinkLabel || null) : existing.main_link_label,
            sacLinkLabel !== undefined ? (sacLinkLabel || null) : existing.sac_link_label,
            restrictedLinkLabel !== undefined ? (restrictedLinkLabel || null) : existing.restricted_link_label,
            existing.id,
          ]
        );
        const { rows } = await client.query(
          `SELECT ${BRANDING_COLUMNS} FROM tenants WHERE id = $1`,
          [existing.id]
        );
        return rows[0];
      });

      if (!tenant) return res.status(404).json({ error: 'Empresa não encontrada.' });
      res.json({ branding: tenant });
    } catch (err) { next(err); }
  }
);

export default router;
