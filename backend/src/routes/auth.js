import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
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

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }

  if (user.tenant_id) {
    const tenant = db.prepare('SELECT status FROM tenants WHERE id = ?').get(user.tenant_id);
    if (tenant?.status === 'PENDING_APPROVAL') {
      return res.status(403).json({ error: 'Sua empresa ainda está aguardando aprovação da CuraLabs3D.' });
    }
    if (tenant?.status === 'REJECTED' || tenant?.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'O acesso da sua empresa está bloqueado. Contate o suporte.' });
    }
  }

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenant_id },
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/register
// Solicitação de conta corporativa (cria Tenant + usuário administrador,
// ambos com status PENDING_APPROVAL até o Super Admin aprovar).
router.post('/register', (req, res) => {
  const { companyName, cnpj, contactEmail, contactPhone, adminName, adminEmail, password } = req.body;

  if (!companyName || !contactEmail || !adminName || !adminEmail || !password) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail.toLowerCase().trim());
  if (existingUser) {
    return res.status(409).json({ error: 'Já existe um usuário com este e-mail.' });
  }

  let slug = slugify(companyName);
  const slugExists = db.prepare('SELECT id FROM tenants WHERE slug = ?').get(slug);
  if (slugExists) slug = `${slug}-${nanoid(4).toLowerCase()}`;

  const tenantId = nanoid();
  const userId = nanoid();
  const passwordHash = bcrypt.hashSync(password, 10);

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO tenants (id, name, slug, cnpj, contact_email, contact_phone, status)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL')
    `).run(tenantId, companyName, slug, cnpj || null, contactEmail, contactPhone || null);

    db.prepare(`
      INSERT INTO users (id, tenant_id, name, email, password_hash, role)
      VALUES (?, ?, ?, ?, ?, 'TENANT_ADMIN')
    `).run(userId, tenantId, adminName, adminEmail.toLowerCase().trim(), passwordHash);
  });
  tx();

  res.status(201).json({
    message: 'Solicitação enviada com sucesso. Aguarde a aprovação da CuraLabs3D.',
    tenant: { id: tenantId, slug, status: 'PENDING_APPROVAL' },
  });
});

export default router;
