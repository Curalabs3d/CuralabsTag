import { Router } from 'express';
import { nanoid } from 'nanoid';
import { withTenantContext } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { resolveTenantScope } from '../middleware/tenant.js';
import { MODULE_KEYS } from '../utils/modules.js';

const router = Router();
const asSuperAdmin = (callback) => withTenantContext({ tenantId: null, role: 'SUPER_ADMIN' }, callback);
// Diferente de asSuperAdmin, o resgate de voucher precisa do tenant REAL de
// quem está resgatando — a policy de RLS em voucher_redemptions exige
// tenant_id = app.current_tenant_id, então o contexto precisa carregar
// esse valor, não ficar fixo em null.
const asVoucherRedemption = (tenantId, callback) => withTenantContext({ tenantId, role: 'VOUCHER_REDEMPTION' }, callback);

function generateCode() {
  // Código curto, digitável, sem caracteres ambíguos (0/O, 1/I)
  return nanoid(8).toUpperCase().replace(/[01OIL]/g, 'X');
}

// ---------- Super Admin: gestão de vouchers ----------
router.use('/admin', requireAuth, requireRole('SUPER_ADMIN'));

router.get('/admin', async (req, res, next) => {
  try {
    const vouchers = await asSuperAdmin(async (client) => {
      const { rows } = await client.query('SELECT * FROM vouchers ORDER BY created_at DESC');
      return rows;
    });
    res.json({ vouchers, availableModules: MODULE_KEYS });
  } catch (err) { next(err); }
});

router.post('/admin', async (req, res, next) => {
  try {
    const { code, description, includedModules, durationDays, maxRedemptions, codeExpiresAt } = req.body;

    if (!durationDays || durationDays < 1) {
      return res.status(400).json({ error: 'duractionDays deve ser um número positivo.' });
    }
    const invalidModule = (includedModules || []).find((m) => !MODULE_KEYS.includes(m));
    if (invalidModule) return res.status(400).json({ error: `Módulo desconhecido: ${invalidModule}` });

    const finalCode = (code || generateCode()).toUpperCase().trim();
    const id = `vch-${nanoid(10).toLowerCase()}`;

    const voucher = await asSuperAdmin(async (client) => {
      await client.query(
        `INSERT INTO vouchers (id, code, description, included_modules, duration_days, max_redemptions, code_expires_at, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          id, finalCode, description || null, JSON.stringify(includedModules || []),
          durationDays, maxRedemptions || 1, codeExpiresAt || null, req.user.id,
        ]
      );
      const { rows } = await client.query('SELECT * FROM vouchers WHERE id = $1', [id]);
      return rows[0];
    });

    res.status(201).json({ voucher });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Já existe um voucher com esse código.' });
    next(err);
  }
});

router.patch('/admin/:id/deactivate', async (req, res, next) => {
  try {
    await asSuperAdmin((client) => client.query('UPDATE vouchers SET active = false WHERE id = $1', [req.params.id]));
    res.json({ message: 'Voucher desativado.' });
  } catch (err) { next(err); }
});

// ---------- Tenant: resgate de voucher ----------
router.post('/redeem', requireAuth, requireRole('TENANT_ADMIN'), resolveTenantScope, async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Informe o código do voucher.' });

    const result = await asVoucherRedemption(req.tenantScope, async (client) => {
      const { rows: voucherRows } = await client.query(
        'SELECT * FROM vouchers WHERE code = $1', [code.toUpperCase().trim()]
      );
      const voucher = voucherRows[0];
      if (!voucher) return { error: 'Código inválido.' };
      if (!voucher.active) return { error: 'Este voucher não está mais ativo.' };
      if (voucher.code_expires_at && new Date(voucher.code_expires_at) < new Date()) {
        return { error: 'Este voucher expirou e não pode mais ser resgatado.' };
      }
      if (voucher.redemption_count >= voucher.max_redemptions) {
        return { error: 'Este voucher já atingiu o limite de usos.' };
      }

      // Um mesmo tenant não pode resgatar o mesmo voucher duas vezes
      const { rows: alreadyRedeemed } = await client.query(
        'SELECT id FROM voucher_redemptions WHERE voucher_id = $1 AND tenant_id = $2',
        [voucher.id, req.tenantScope]
      );
      if (alreadyRedeemed[0]) return { error: 'Sua empresa já resgatou este voucher anteriormente.' };

      const expiresAt = new Date(Date.now() + voucher.duration_days * 24 * 60 * 60 * 1000);
      const redemptionId = `vred-${nanoid(10).toLowerCase()}`;

      await client.query(
        'INSERT INTO voucher_redemptions (id, voucher_id, tenant_id, expires_at) VALUES ($1,$2,$3,$4)',
        [redemptionId, voucher.id, req.tenantScope, expiresAt.toISOString()]
      );
      await client.query('UPDATE vouchers SET redemption_count = redemption_count + 1 WHERE id = $1', [voucher.id]);

      // Aplica cada módulo do voucher como override temporário — mas nunca
      // encurta um acesso que já é permanente ou já vai mais longe no tempo
      // (ex: concedido manualmente por um Super Admin antes). Resgatar um
      // voucher deve sempre ESTENDER acesso, nunca reduzir o que já existe.
      const includedModules = voucher.included_modules || [];
      for (const moduleKey of includedModules) {
        const overrideId = `mo-${nanoid(10).toLowerCase()}`;
        await client.query(
          `INSERT INTO tenant_module_overrides (id, tenant_id, module_key, enabled, granted_by, expires_at)
           VALUES ($1,$2,$3,true,$4,$5)
           ON CONFLICT (tenant_id, module_key) DO UPDATE SET
             enabled = true,
             granted_by = EXCLUDED.granted_by,
             expires_at = CASE
               WHEN tenant_module_overrides.expires_at IS NULL THEN NULL
               WHEN EXCLUDED.expires_at IS NULL THEN NULL
               WHEN EXCLUDED.expires_at > tenant_module_overrides.expires_at THEN EXCLUDED.expires_at
               ELSE tenant_module_overrides.expires_at
             END`,
          [overrideId, req.tenantScope, moduleKey, req.user.id, expiresAt.toISOString()]
        );
      }

      return { expiresAt, includedModules };
    });

    if (result.error) return res.status(400).json({ error: result.error });
    res.json({
      message: `Voucher resgatado! Acesso liberado até ${new Date(result.expiresAt).toLocaleDateString('pt-BR')}.`,
      expiresAt: result.expiresAt,
      includedModules: result.includedModules,
    });
  } catch (err) { next(err); }
});

export default router;
