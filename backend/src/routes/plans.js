import { Router } from 'express';
import { nanoid } from 'nanoid';
import { withTenantContext } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { MODULE_CATALOG, MODULE_KEYS } from '../utils/modules.js';

const router = Router();

const asSuperAdmin = (callback) => withTenantContext({ tenantId: null, role: 'SUPER_ADMIN' }, callback);
// Leitura pública (página de venda) não passa por autenticação — usa o
// mesmo contexto PUBLIC_LOOKUP já validado no restante do sistema.
const asPublicLookup = (callback) => withTenantContext({ tenantId: null, role: 'PUBLIC_LOOKUP' }, callback);

// GET /api/plans — pública, para a página de venda
router.get('/', async (req, res, next) => {
  try {
    const plans = await asPublicLookup(async (client) => {
      const { rows } = await client.query('SELECT * FROM plans WHERE active = true ORDER BY display_order');
      return rows;
    });
    res.json({ plans, modules: MODULE_CATALOG });
  } catch (err) { next(err); }
});

// GET /api/plans/modules — catálogo de módulos disponíveis (para as telas de admin)
router.get('/modules', requireAuth, requireRole('SUPER_ADMIN'), (req, res) => {
  res.json({ modules: MODULE_CATALOG, keys: MODULE_KEYS });
});

// A partir daqui, exclusivo do Super Admin
router.use(requireAuth, requireRole('SUPER_ADMIN'));

// GET /api/plans/all — todos os planos, incluindo inativos
router.get('/all', async (req, res, next) => {
  try {
    const plans = await asSuperAdmin(async (client) => {
      const { rows } = await client.query('SELECT * FROM plans ORDER BY display_order');
      return rows;
    });
    res.json({ plans });
  } catch (err) { next(err); }
});

// POST /api/plans
router.post('/', async (req, res, next) => {
  try {
    const { name, monthlyPrice, description, tagLimit, includedModules, displayOrder } = req.body;
    if (!name || monthlyPrice === undefined) {
      return res.status(400).json({ error: 'Nome e preço mensal são obrigatórios.' });
    }
    const invalidModule = (includedModules || []).find((m) => !MODULE_KEYS.includes(m));
    if (invalidModule) return res.status(400).json({ error: `Módulo desconhecido: ${invalidModule}` });

    const id = `plan-${nanoid(8).toLowerCase()}`;
    const plan = await asSuperAdmin(async (client) => {
      await client.query(
        `INSERT INTO plans (id, name, monthly_price, description, tag_limit, included_modules, display_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, name, monthlyPrice, description || null, tagLimit ?? null, JSON.stringify(includedModules || []), displayOrder || 0]
      );
      const { rows } = await client.query('SELECT * FROM plans WHERE id = $1', [id]);
      return rows[0];
    });
    res.status(201).json({ plan });
  } catch (err) { next(err); }
});

// PUT /api/plans/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { name, monthlyPrice, description, tagLimit, includedModules, active, displayOrder } = req.body;
    if (includedModules) {
      const invalidModule = includedModules.find((m) => !MODULE_KEYS.includes(m));
      if (invalidModule) return res.status(400).json({ error: `Módulo desconhecido: ${invalidModule}` });
    }

    const plan = await asSuperAdmin(async (client) => {
      const { rows: existingRows } = await client.query('SELECT * FROM plans WHERE id = $1', [req.params.id]);
      const existing = existingRows[0];
      if (!existing) return null;

      await client.query(
        `UPDATE plans SET name=$1, monthly_price=$2, description=$3, tag_limit=$4, included_modules=$5, active=$6, display_order=$7 WHERE id=$8`,
        [
          name ?? existing.name,
          monthlyPrice ?? existing.monthly_price,
          description !== undefined ? description : existing.description,
          tagLimit !== undefined ? tagLimit : existing.tag_limit,
          JSON.stringify(includedModules ?? existing.included_modules),
          active !== undefined ? active : existing.active,
          displayOrder !== undefined ? displayOrder : existing.display_order,
          existing.id,
        ]
      );
      const { rows } = await client.query('SELECT * FROM plans WHERE id = $1', [existing.id]);
      return rows[0];
    });

    if (!plan) return res.status(404).json({ error: 'Plano não encontrado.' });
    res.json({ plan });
  } catch (err) { next(err); }
});

export default router;
