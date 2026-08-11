import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Todas as rotas abaixo são exclusivas do SUPER_ADMIN da CuraLabs3D
router.use(requireAuth, requireRole('SUPER_ADMIN'));

// GET /api/tenants  (?status=PENDING_APPROVAL)
router.get('/', (req, res) => {
  const { status } = req.query;
  const rows = status
    ? db.prepare('SELECT * FROM tenants WHERE status = ? ORDER BY created_at DESC').all(status)
    : db.prepare('SELECT * FROM tenants ORDER BY created_at DESC').all();

  const withCounts = rows.map((t) => ({
    ...t,
    tagCount: db.prepare('SELECT COUNT(*) AS c FROM nfc_tags WHERE tenant_id = ?').get(t.id).c,
  }));

  res.json({ tenants: withCounts });
});

// GET /api/tenants/overview  — números para o painel master
router.get('/overview', (req, res) => {
  const totalTags = db.prepare('SELECT COUNT(*) AS c FROM nfc_tags').get().c;
  const activeTenants = db.prepare("SELECT COUNT(*) AS c FROM tenants WHERE status = 'ACTIVE'").get().c;
  const pendingTenants = db.prepare("SELECT COUNT(*) AS c FROM tenants WHERE status = 'PENDING_APPROVAL'").get().c;
  const totalScans = db.prepare('SELECT COALESCE(SUM(scan_count),0) AS c FROM nfc_tags').get().c;

  res.json({ totalTags, activeTenants, pendingTenants, totalScans });
});

// PATCH /api/tenants/:id/approve
router.patch('/:id/approve', (req, res) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Empresa não encontrada.' });

  db.prepare("UPDATE tenants SET status = 'ACTIVE', approved_at = datetime('now') WHERE id = ?").run(tenant.id);
  res.json({ message: 'Empresa aprovada com sucesso.' });
});

// PATCH /api/tenants/:id/reject
router.patch('/:id/reject', (req, res) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Empresa não encontrada.' });

  db.prepare("UPDATE tenants SET status = 'REJECTED' WHERE id = ?").run(tenant.id);
  res.json({ message: 'Empresa rejeitada.' });
});

// PATCH /api/tenants/:id/suspend
router.patch('/:id/suspend', (req, res) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Empresa não encontrada.' });

  db.prepare("UPDATE tenants SET status = 'SUSPENDED' WHERE id = ?").run(tenant.id);
  res.json({ message: 'Empresa suspensa.' });
});

export default router;
