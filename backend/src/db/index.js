import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn(
    '⚠️  DATABASE_URL não definida. Configure a connection string do Postgres/Supabase no .env ' +
    '(veja backend/.env.example).'
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

pool.on('error', (err) => {
  console.error('Erro inesperado no pool de conexões do Postgres:', err);
});

// -----------------------------------------------------------------------
// Contexto de Tenant para RLS
// -----------------------------------------------------------------------
// Toda query que precisa respeitar o isolamento multi-tenant deve passar
// por withTenantContext, que abre uma transação, popula as variáveis de
// sessão que as policies de RLS leem (app.current_tenant_id / app.current_role)
// e executa o callback dentro dela. Isso garante que, mesmo que um bug na
// aplicação esqueça de filtrar por tenant_id, o Postgres barra o acesso
// no nível da política — desde que o backend esteja conectado com a role
// "app_backend" (não-superusuário), não com a role "postgres" padrão.
// -----------------------------------------------------------------------
export async function withTenantContext({ tenantId, role }, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.current_role', role || '']);
    await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant_id', tenantId || '']);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Para operações que não dependem de contexto de tenant (ex: login, antes
// de sabermos quem é o usuário) — usa o pool diretamente, sem RLS especial.
export async function query(text, params) {
  return pool.query(text, params);
}

export default pool;
