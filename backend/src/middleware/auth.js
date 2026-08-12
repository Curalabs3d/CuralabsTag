import jwt from 'jsonwebtoken';
import { withTenantContext } from '../db/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, tenantId: user.tenant_id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

// Garante que existe um token válido e popula req.user.
// A busca do usuário por id acontece antes de sabermos seu tenant, então
// usa o contexto explícito AUTH_LOOKUP (ver policy de RLS em users).
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticação ausente.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await withTenantContext({ tenantId: null, role: 'AUTH_LOOKUP' }, async (client) => {
      const { rows } = await client.query('SELECT id, tenant_id, name, email, role FROM users WHERE id = $1', [payload.sub]);
      return rows[0];
    });
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado.' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

// Restringe a rota a determinados papéis (roles)
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado para este perfil de usuário.' });
    }
    next();
  };
}
