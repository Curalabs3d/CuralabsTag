// Middleware de isolamento Multi-Tenant.
// Regra de ouro: um TENANT_ADMIN / TENANT_USER NUNCA enxerga dados de outro
// tenant. O tenantId efetivo vem sempre do token (req.user.tenant_id),
// nunca de um parâmetro vindo do cliente.
//
// Além do filtro feito nas queries da aplicação, req.tenantContext é usado
// por withTenantContext() (src/db/index.js) para popular as variáveis de
// sessão que as policies de RLS do Postgres leem — uma segunda camada de
// proteção, agora também aplicada pelo próprio banco de dados.
export function resolveTenantScope(req, res, next) {
  if (req.user.role === 'SUPER_ADMIN') {
    // Super Admin pode opcionalmente filtrar por tenant via query (?tenantId=)
    req.tenantScope = req.query.tenantId || null;
    req.tenantContext = { tenantId: req.tenantScope, role: 'SUPER_ADMIN' };
    return next();
  }

  if (!req.user.tenant_id) {
    return res.status(403).json({ error: 'Usuário sem empresa (tenant) associada.' });
  }

  req.tenantScope = req.user.tenant_id;
  req.tenantContext = { tenantId: req.user.tenant_id, role: req.user.role };
  next();
}
