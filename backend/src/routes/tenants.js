import { Router } from 'express';
import { withTenantContext } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Todas as rotas abaixo são exclusivas do SUPER_ADMIN da CuraLabs3D.
// Todas as queries passam por withTenantContext com role = SUPER_ADMIN,
// que é a única condição que as policies de RLS aceitam para liberar
// acesso irrestrito a todos os tenants.
router.use(requireAuth, requireRole('SUPER_ADMIN'));

const asSuperAdmin = (callback) => withTenantContext({ tenantId: null, role: 'SUPER_ADMIN' }, callback);

// GET /api/tenants  (?status=PENDING_APPROVAL)
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const tenants = await asSuperAdmin(async (client) => {
      const { rows } = status
        ? await client.query('SELECT * FROM tenants WHERE status = $1 ORDER BY created_at DESC', [status])
        : await client.query('SELECT * FROM tenants ORDER BY created_at DESC');

      return Promise.all(rows.map(async (t) => {
        const { rows: countRows } = await client.query('SELECT COUNT(*)::int AS c FROM nfc_tags WHERE tenant_id = $1', [t.id]);
        return { ...t, tagCount: countRows[0].c };
      }));
    });

    res.json({ tenants });
  } catch (err) { next(err); }
});

// GET /api/tenants/overview — números para o painel master
router.get('/overview', async (req, res, next) => {
  try {
    const overview = await asSuperAdmin(async (client) => {
      const [{ rows: tags }, { rows: active }, { rows: pending }, { rows: scans }] = await Promise.all([
        client.query('SELECT COUNT(*)::int AS c FROM nfc_tags'),
        client.query("SELECT COUNT(*)::int AS c FROM tenants WHERE status = 'ACTIVE'"),
        client.query("SELECT COUNT(*)::int AS c FROM tenants WHERE status = 'PENDING_APPROVAL'"),
        client.query('SELECT COALESCE(SUM(scan_count),0)::int AS c FROM nfc_tags'),
      ]);
      return {
        totalTags: tags[0].c,
        activeTenants: active[0].c,
        pendingTenants: pending[0].c,
        totalScans: scans[0].c,
      };
    });

    res.json(overview);
  } catch (err) { next(err); }
});

async function updateTenantStatus(req, res, next, newStatus, extraSql = '') {
  try {
    const result = await asSuperAdmin(async (client) => {
      const { rows } = await client.query('SELECT * FROM tenants WHERE id = $1', [req.params.id]);
      if (!rows[0]) return null;
      await client.query(`UPDATE tenants SET status = $1${extraSql} WHERE id = $2`, [newStatus, rows[0].id]);
      return rows[0];
    });

    if (!result) return res.status(404).json({ error: 'Empresa não encontrada.' });
    res.json({ message: 'Status atualizado com sucesso.' });
  } catch (err) { next(err); }
}

// PATCH /api/tenants/:id/approve
router.patch('/:id/approve', (req, res, next) =>
  updateTenantStatus(req, res, next, 'ACTIVE', ', approved_at = now()')
);

// PATCH /api/tenants/:id/reject
router.patch('/:id/reject', (req, res, next) => updateTenantStatus(req, res, next, 'REJECTED'));

// PATCH /api/tenants/:id/suspend
router.patch('/:id/suspend', (req, res, next) => updateTenantStatus(req, res, next, 'SUSPENDED'));

export default router;
