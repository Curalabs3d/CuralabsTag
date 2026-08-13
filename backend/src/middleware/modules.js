import { withTenantContext } from '../db/index.js';

// Resolve o conjunto final de módulos habilitados para um tenant:
// módulos do plano contratado, com overrides pontuais aplicados por cima
// (um SUPER_ADMIN pode liberar ou bloquear um módulo específico fora do
// que o plano prevê — cortesia, teste estendido, etc.)
// Retorna módulos habilitados + limite de tags do plano vigente, numa só
// consulta — usado nos pontos que precisam checar as duas coisas juntas
// (ex: criar uma tag exige checar módulo E limite numérico).
export async function getTenantPlanInfo(client, tenantId) {
  const { rows: subRows } = await client.query(
    `SELECT p.included_modules, p.tag_limit FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.tenant_id = $1 AND s.status IN ('TRIAL','ACTIVE','PAST_DUE')`,
    [tenantId]
  );
  const planModules = new Set(subRows[0]?.included_modules || []);
  const tagLimit = subRows[0]?.tag_limit ?? null; // null = sem plano ativo OU ilimitado; distinguimos abaixo

  const { rows: overrideRows } = await client.query(
    'SELECT module_key, enabled FROM tenant_module_overrides WHERE tenant_id = $1',
    [tenantId]
  );
  for (const { module_key, enabled } of overrideRows) {
    if (enabled) planModules.add(module_key);
    else planModules.delete(module_key);
  }

  return { modules: [...planModules], tagLimit, hasActiveSubscription: !!subRows[0] };
}

export async function getTenantModules(client, tenantId) {
  const { modules } = await getTenantPlanInfo(client, tenantId);
  return modules;
}

// Middleware de rota: bloqueia o acesso se o módulo não estiver habilitado
// para o tenant do usuário logado. SUPER_ADMIN sempre passa.
export function requireModule(moduleKey) {
  return async (req, res, next) => {
    try {
      if (req.user.role === 'SUPER_ADMIN') return next();
      if (!req.tenantScope) return res.status(403).json({ error: 'Usuário sem empresa associada.' });

      const modules = await withTenantContext(req.tenantContext, (client) => getTenantModules(client, req.tenantScope));
      if (!modules.includes(moduleKey)) {
        return res.status(403).json({
          error: 'Este recurso não está disponível no seu plano atual. Fale com a CuraLabs3D para fazer upgrade.',
          moduleKey,
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
