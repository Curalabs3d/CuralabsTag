// Popula o banco com um Super Admin e o Tenant de exemplo "Giacomelli Imóveis".
// Uso: npm run seed  (requer DATABASE_URL configurada no .env)
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import { pool } from './index.js';

async function upsertSuperAdmin() {
  const email = 'admin@curalabs3d.com.br';
  const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (rows[0]) return console.log('Super Admin já existe, pulando.');

  const passwordHash = bcrypt.hashSync('CuraLabs3D#2025', 10);
  await pool.query(
    `INSERT INTO users (id, tenant_id, name, email, password_hash, role)
     VALUES ($1, NULL, $2, $3, $4, 'SUPER_ADMIN')`,
    [nanoid(), 'Admin CuraLabs3D', email, passwordHash]
  );
  console.log(`Super Admin criado -> ${email} / senha: CuraLabs3D#2025`);
}

async function upsertDemoTenant() {
  const slug = 'giacomelli-imoveis';
  let { rows } = await pool.query('SELECT * FROM tenants WHERE slug = $1', [slug]);
  let tenant = rows[0];

  if (!tenant) {
    const id = nanoid();
    await pool.query(
      `INSERT INTO tenants (id, name, slug, cnpj, contact_email, contact_phone, status, approved_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', now())`,
      [id, 'Giacomelli Imóveis', slug, '00.000.000/0001-00', 'contato@giacomelliimoveis.com.br', '(48) 99999-0000']
    );
    ({ rows } = await pool.query('SELECT * FROM tenants WHERE id = $1', [id]));
    tenant = rows[0];
    console.log('Tenant "Giacomelli Imóveis" criado.');
  }

  const email = 'gestor@giacomelliimoveis.com.br';
  const { rows: userRows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (!userRows[0]) {
    const passwordHash = bcrypt.hashSync('Giacomelli#2025', 10);
    await pool.query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, 'TENANT_ADMIN')`,
      [nanoid(), tenant.id, 'Gestor Giacomelli', email, passwordHash]
    );
    console.log(`Usuário do Tenant criado -> ${email} / senha: Giacomelli#2025`);
  }

  const { rows: countRows } = await pool.query('SELECT COUNT(*)::int AS c FROM nfc_tags WHERE tenant_id = $1', [tenant.id]);
  if (countRows[0].c === 0) {
    const demoItems = [
      ['TAG-001', 'GIA-8901', 'Apartamento Edifício Aurora, 302', 'https://giacomelliimoveis.com.br/imovel/8901', 'https://giacomelliimoveis.com.br/sac', 'https://giacomelliimoveis.com.br/area-restrita'],
      ['TAG-002', 'GIA-8902', 'Casa Jardim das Palmeiras', 'https://giacomelliimoveis.com.br/imovel/8902', 'https://giacomelliimoveis.com.br/sac', 'https://giacomelliimoveis.com.br/area-restrita'],
      ['TAG-003', 'GIA-8903', 'Cobertura Beira-Mar', 'https://giacomelliimoveis.com.br/imovel/8903', 'https://giacomelliimoveis.com.br/sac', 'https://giacomelliimoveis.com.br/area-restrita'],
    ];
    for (const [tagId, code, title, main, sac, restricted] of demoItems) {
      await pool.query(
        `INSERT INTO nfc_tags (id, tenant_id, tag_id, item_code, item_title, main_link, sac_link, restricted_link, photo_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL)`,
        [nanoid(), tenant.id, tagId, code, title, main, sac, restricted]
      );
    }
    console.log('Tags NFC de exemplo criadas.');
  }
}

async function main() {
  await upsertSuperAdmin();
  await upsertDemoTenant();
  console.log('Seed concluído.');
  await pool.end();
}

main().catch(async (err) => {
  console.error('Erro no seed:', err);
  await pool.end();
  process.exit(1);
});
