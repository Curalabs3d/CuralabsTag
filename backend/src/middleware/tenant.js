// Middleware de isolamento Multi-Tenant.
// Regra de ouro: um TENANT_ADMIN / TENANT_USER NUNCA enxerga dados de outro
// tenant. O tenantId efetivo vem sempre do token (req.user.tenant_id),
// nunca de um parâmetro vindo do cliente — isso evita que alguém tente
// simplesmente trocar o tenantId na URL/body para acessar dados de outra empresa.
export function resolveTenantScope(req, res, next) {
  if (req.user.role === 'SUPER_ADMIN') {
    // Super Admin pode opcionalmente filtrar por tenant via query (?tenantId=)
    req.tenantScope = req.query.tenantId || null;
    return next();
  }

  if (!req.user.tenant_id) {
    return res.status(403).json({ error: 'Usuário sem empresa (tenant) associada.' });
  }

  req.tenantScope = req.user.tenant_id;
  next();
}
