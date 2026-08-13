import { Router } from 'express';
import { nanoid } from 'nanoid';
import { withTenantContext } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { resolveTenantScope } from '../middleware/tenant.js';
import { getTenantModules } from '../middleware/modules.js';
import { MODULE_KEYS } from '../utils/modules.js';

const router = Router();
const asSuperAdmin = (callback) => withTenantContext({ tenantId: null, role: 'SUPER_ADMIN' }, callback);

router.use(requireAuth);

// GET /api/subscriptions/me — a própria assinatura do tenant logado (aba Admin)
router.get('/me', requireRole('TENANT_ADMIN', 'TENANT_USER'), resolveTenantScope, async (req, res, next) => {
  try {
    const data = await withTenantContext(req.tenantContext, async (client) => {
      const { rows } = await client.query(
        `SELECT s.*, p.name AS plan_name, p.monthly_price, p.tag_limit, p.included_modules
         FROM subscriptions s JOIN plans p ON p.id = s.plan_id
         WHERE s.tenant_id = $1`,
        [req.tenantScope]
      );
      const subscription = rows[0] || null;

      const { rows: historyRows } = await client.query(
        `SELECT bh.* FROM billing_history bh
         JOIN subscriptions s ON s.id = bh.subscription_id
         WHERE s.tenant_id = $1 ORDER BY bh.created_at DESC LIMIT 12`,
        [req.tenantScope]
      );

      const modules = await getTenantModules(client, req.tenantScope);
      const { rows: tagCountRows } = await client.query('SELECT COUNT(*)::int AS c FROM nfc_tags WHERE tenant_id = $1', [req.tenantScope]);

      return { subscription, history: historyRows, modules, tagCount: tagCountRows[0].c };
    });
    res.json(data);
  } catch (err) { next(err); }
});

// A partir daqui, exclusivo do Super Admin
router.use(requireRole('SUPER_ADMIN'));

// GET /api/subscriptions — todas as assinaturas (painel master)
router.get('/', async (req, res, next) => {
  try {
    const subscriptions = await asSuperAdmin(async (client) => {
      const { rows } = await client.query(
        `SELECT s.*, t.name AS tenant_name, p.name AS plan_name, p.monthly_price
         FROM subscriptions s
         JOIN tenants t ON t.id = s.tenant_id
         JOIN plans p ON p.id = s.plan_id
         ORDER BY s.created_at DESC`
      );
      return rows;
    });
    res.json({ subscriptions });
  } catch (err) { next(err); }
});

// PUT /api/subscriptions/:id — Super Admin ajusta plano/status manualmente
router.put('/:id', async (req, res, next) => {
  try {
    const { planId, status, gracePeriodDays } = req.body;
    const updated = await asSuperAdmin(async (client) => {
      const { rows: existingRows } = await client.query('SELECT * FROM subscriptions WHERE id = $1', [req.params.id]);
      const existing = existingRows[0];
      if (!existing) return null;

      await client.query(
        `UPDATE subscriptions SET plan_id = $1, status = $2, grace_period_days = $3, updated_at = now() WHERE id = $4`,
        [planId ?? existing.plan_id, status ?? existing.status, gracePeriodDays ?? existing.grace_period_days, existing.id]
      );
      const { rows } = await client.query('SELECT * FROM subscriptions WHERE id = $1', [existing.id]);
      return rows[0];
    });

    if (!updated) return res.status(404).json({ error: 'Assinatura não encontrada.' });
    res.json({ subscription: updated });
  } catch (err) { next(err); }
});

// GET /api/subscriptions/tenant/:tenantId/overrides — overrides de módulo de um tenant
router.get('/tenant/:tenantId/overrides', async (req, res, next) => {
  try {
    const overrides = await asSuperAdmin(async (client) => {
      const { rows } = await client.query('SELECT * FROM tenant_module_overrides WHERE tenant_id = $1', [req.params.tenantId]);
      return rows;
    });
    res.json({ overrides, availableModules: MODULE_KEYS });
  } catch (err) { next(err); }
});

// PUT /api/subscriptions/tenant/:tenantId/overrides — define um override pontual
router.put('/tenant/:tenantId/overrides', async (req, res, next) => {
  try {
    const { moduleKey, enabled } = req.body;
    if (!MODULE_KEYS.includes(moduleKey)) return res.status(400).json({ error: 'Módulo desconhecido.' });

    const override = await asSuperAdmin(async (client) => {
      const id = `mo-${nanoid(10).toLowerCase()}`;
      await client.query(
        `INSERT INTO tenant_module_overrides (id, tenant_id, module_key, enabled, granted_by)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (tenant_id, module_key) DO UPDATE SET enabled = EXCLUDED.enabled, granted_by = EXCLUDED.granted_by`,
        [id, req.params.tenantId, moduleKey, !!enabled, req.user.id]
      );
      const { rows } = await client.query(
        'SELECT * FROM tenant_module_overrides WHERE tenant_id = $1 AND module_key = $2',
        [req.params.tenantId, moduleKey]
      );
      return rows[0];
    });
    res.json({ override });
  } catch (err) { next(err); }
});

// DELETE /api/subscriptions/tenant/:tenantId/overrides/:moduleKey — remove o override (volta ao padrão do plano)
router.delete('/tenant/:tenantId/overrides/:moduleKey', async (req, res, next) => {
  try {
    await asSuperAdmin((client) =>
      client.query('DELETE FROM tenant_module_overrides WHERE tenant_id = $1 AND module_key = $2', [req.params.tenantId, req.params.moduleKey])
    );
    res.json({ message: 'Override removido.' });
  } catch (err) { next(err); }
});

export default router;
