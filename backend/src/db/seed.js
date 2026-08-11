// Popula o banco com um Super Admin e o Tenant de exemplo "Giacomelli Imóveis".
// Uso: npm run seed
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import { db } from './index.js';

function upsertSuperAdmin() {
  const email = 'admin@curalabs3d.com.br';
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return console.log('Super Admin já existe, pulando.');

  const passwordHash = bcrypt.hashSync('CuraLabs3D#2025', 10);
  db.prepare(`
    INSERT INTO users (id, tenant_id, name, email, password_hash, role)
    VALUES (?, NULL, ?, ?, ?, 'SUPER_ADMIN')
  `).run(nanoid(), 'Admin CuraLabs3D', email, passwordHash);

  console.log(`Super Admin criado -> ${email} / senha: CuraLabs3D#2025`);
}

function upsertDemoTenant() {
  const slug = 'giacomelli-imoveis';
  let tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(slug);

  if (!tenant) {
    const id = nanoid();
    db.prepare(`
      INSERT INTO tenants (id, name, slug, cnpj, contact_email, contact_phone, status, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', datetime('now'))
    `).run(id, 'Giacomelli Imóveis', slug, '00.000.000/0001-00', 'contato@giacomelliimoveis.com.br', '(48) 99999-0000');
    tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id);
    console.log('Tenant "Giacomelli Imóveis" criado.');
  }

  const email = 'gestor@giacomelliimoveis.com.br';
  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!existingUser) {
    const passwordHash = bcrypt.hashSync('Giacomelli#2025', 10);
    db.prepare(`
      INSERT INTO users (id, tenant_id, name, email, password_hash, role)
      VALUES (?, ?, ?, ?, ?, 'TENANT_ADMIN')
    `).run(nanoid(), tenant.id, 'Gestor Giacomelli', email, passwordHash);
    console.log(`Usuário do Tenant criado -> ${email} / senha: Giacomelli#2025`);
  }

  // Algumas tags de exemplo
  const count = db.prepare('SELECT COUNT(*) AS c FROM nfc_tags WHERE tenant_id = ?').get(tenant.id).c;
  if (count === 0) {
    const insert = db.prepare(`
      INSERT INTO nfc_tags (id, tenant_id, tag_id, item_code, item_title, main_link, sac_link, restricted_link, photo_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const demoItems = [
      ['TAG-001', 'GIA-8901', 'Apartamento Edifício Aurora, 302', 'https://giacomelliimoveis.com.br/imovel/8901', 'https://giacomelliimoveis.com.br/sac', 'https://giacomelliimoveis.com.br/area-restrita'],
      ['TAG-002', 'GIA-8902', 'Casa Jardim das Palmeiras', 'https://giacomelliimoveis.com.br/imovel/8902', 'https://giacomelliimoveis.com.br/sac', 'https://giacomelliimoveis.com.br/area-restrita'],
      ['TAG-003', 'GIA-8903', 'Cobertura Beira-Mar', 'https://giacomelliimoveis.com.br/imovel/8903', 'https://giacomelliimoveis.com.br/sac', 'https://giacomelliimoveis.com.br/area-restrita'],
    ];
    for (const [tagId, code, title, main, sac, restricted] of demoItems) {
      insert.run(nanoid(), tenant.id, tagId, code, title, main, sac, restricted, null);
    }
    console.log('Tags NFC de exemplo criadas.');
  }
}

upsertSuperAdmin();
upsertDemoTenant();
console.log('Seed concluído.');
