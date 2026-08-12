import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { withTenantContext } from '../db/index.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

function slugify(text) {
  return text
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const asAuthLookup = (callback) => withTenantContext({ tenantId: null, role: 'AUTH_LOOKUP' }, callback);

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Informe e-mail e senha.' });
    }

    const outcome = await asAuthLookup(async (client) => {
      const { rows } = await client.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
      const user = rows[0];
      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return { error: 'Credenciais inválidas.', status: 401 };
      }

      if (user.tenant_id) {
        const { rows: tenantRows } = await client.query('SELECT status FROM tenants WHERE id = $1', [user.tenant_id]);
        const tenant = tenantRows[0];
        if (tenant?.status === 'PENDING_APPROVAL') {
          return { error: 'Sua empresa ainda está aguardando aprovação da CuraLabs3D.', status: 403 };
        }
        if (tenant?.status === 'REJECTED' || tenant?.status === 'SUSPENDED') {
          return { error: 'O acesso da sua empresa está bloqueado. Contate o suporte.', status: 403 };
        }
      }

      return { user };
    });

    if (outcome.error) return res.status(outcome.status).json({ error: outcome.error });

    const { user } = outcome;
    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenant_id },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/register
// Solicitação de conta corporativa (cria Tenant + usuário administrador,
// ambos com status PENDING_APPROVAL até o Super Admin aprovar).
router.post('/register', async (req, res, next) => {
  try {
    const { companyName, cnpj, contactEmail, contactPhone, adminName, adminEmail, password } = req.body;

    if (!companyName || !contactEmail || !adminName || !adminEmail || !password) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    }

    const outcome = await asAuthLookup(async (client) => {
      const { rows: existingRows } = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail.toLowerCase().trim()]);
      if (existingRows[0]) return { error: 'Já existe um usuário com este e-mail.' };

      let slug = slugify(companyName);
      const { rows: slugRows } = await client.query('SELECT id FROM tenants WHERE slug = $1', [slug]);
      if (slugRows[0]) slug = `${slug}-${nanoid(4).toLowerCase()}`;

      const tenantId = nanoid();
      const userId = nanoid();
      const passwordHash = bcrypt.hashSync(password, 10);

      await client.query(
        `INSERT INTO tenants (id, name, slug, cnpj, contact_email, contact_phone, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING_APPROVAL')`,
        [tenantId, companyName, slug, cnpj || null, contactEmail, contactPhone || null]
      );
      await client.query(
        `INSERT INTO users (id, tenant_id, name, email, password_hash, role)
         VALUES ($1, $2, $3, $4, $5, 'TENANT_ADMIN')`,
        [userId, tenantId, adminName, adminEmail.toLowerCase().trim(), passwordHash]
      );

      return { tenantId, slug };
    });

    if (outcome.error) return res.status(409).json({ error: outcome.error });

    res.status(201).json({
      message: 'Solicitação enviada com sucesso. Aguarde a aprovação da CuraLabs3D.',
      tenant: { id: outcome.tenantId, slug: outcome.slug, status: 'PENDING_APPROVAL' },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
