import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { nanoid } from 'nanoid';
import { withTenantContext } from '../db/index.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { sendPasswordResetEmail } from '../services/email.js';

const router = Router();
const FRONTEND_URL = process.env.PUBLIC_BASE_URL || 'https://nfc.curalabs3d.com.br';
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

function slugify(text) {
  return text
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
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

// POST /api/auth/forgot-password
// Sempre responde com sucesso genérico, exista ou não o e-mail — evita que
// alguém use esse endpoint para descobrir quais e-mails têm conta no sistema.
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Informe o e-mail.' });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    const user = await asAuthLookup(async (client) => {
      const { rows } = await client.query('SELECT id, name, email FROM users WHERE email = $1', [email.toLowerCase().trim()]);
      const found = rows[0];
      if (!found) return null;

      await client.query(
        'UPDATE users SET reset_token_hash = $1, reset_token_expires_at = $2 WHERE id = $3',
        [tokenHash, expiresAt.toISOString(), found.id]
      );
      return found;
    });

    if (user) {
      const resetUrl = `${FRONTEND_URL}/redefinir-senha?token=${rawToken}`;
      await sendPasswordResetEmail({ to: user.email, resetUrl, userName: user.name });
    }

    res.json({ message: 'Se este e-mail estiver cadastrado, você receberá um link de recuperação em instantes.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token e nova senha são obrigatórios.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
    }

    const tokenHash = hashToken(token);

    const outcome = await asAuthLookup(async (client) => {
      const { rows } = await client.query(
        'SELECT id, reset_token_expires_at FROM users WHERE reset_token_hash = $1',
        [tokenHash]
      );
      const user = rows[0];
      if (!user) return { error: 'Link inválido ou já utilizado.' };
      if (new Date(user.reset_token_expires_at) < new Date()) {
        return { error: 'Este link expirou. Solicite uma nova recuperação de senha.' };
      }

      const passwordHash = bcrypt.hashSync(newPassword, 10);
      await client.query(
        'UPDATE users SET password_hash = $1, reset_token_hash = NULL, reset_token_expires_at = NULL WHERE id = $2',
        [passwordHash, user.id]
      );
      return { ok: true };
    });

    if (outcome.error) return res.status(400).json({ error: outcome.error });
    res.json({ message: 'Senha redefinida com sucesso. Você já pode entrar com a nova senha.' });
  } catch (err) {
    next(err);
  }
});

export default router;
