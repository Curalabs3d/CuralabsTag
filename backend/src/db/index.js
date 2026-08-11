import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = process.env.SQLITE_PATH || './data/curalabs3d.db';
const absoluteDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);

fs.mkdirSync(path.dirname(absoluteDbPath), { recursive: true });

export const db = new Database(absoluteDbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// -----------------------------------------------------------------------
// SCHEMA
// -----------------------------------------------------------------------
// Observação sobre multi-tenancy:
// Toda tabela "de negócio" carrega uma coluna tenant_id. Em SQLite isso é
// garantido na camada de aplicação (middleware/tenant.js). Ao migrar para
// Postgres/Supabase, a mesma coluna tenant_id deve virar a base das
// políticas de Row Level Security (ver README.md).
// -----------------------------------------------------------------------

db.exec(`
CREATE TABLE IF NOT EXISTS tenants (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  cnpj          TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  logo_url      TEXT,
  status        TEXT NOT NULL DEFAULT 'PENDING_APPROVAL'
                CHECK (status IN ('PENDING_APPROVAL','ACTIVE','REJECTED','SUSPENDED')),
  plan          TEXT NOT NULL DEFAULT 'STANDARD',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at   TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'TENANT_USER'
                CHECK (role IN ('SUPER_ADMIN','TENANT_ADMIN','TENANT_USER')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cada "tag" representa um chaveiro NFC físico já gravado ou pronto para gravar.
CREATE TABLE IF NOT EXISTS nfc_tags (
  id                      TEXT PRIMARY KEY,
  tenant_id               TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tag_id                  TEXT NOT NULL,             -- ex: TAG-001
  item_code               TEXT,                      -- ex: GIA-8902
  item_title              TEXT,                      -- ex: "Apartamento Edifício Aurora"
  main_link               TEXT,
  sac_link                TEXT,
  restricted_link         TEXT,
  photo_url               TEXT,
  is_active               INTEGER NOT NULL DEFAULT 1,
  scan_count              INTEGER NOT NULL DEFAULT 0,
  -- Parametrização de capacidade NFC (por tag individual)
  nfc_model               TEXT NOT NULL DEFAULT 'NTAG213'
                          CHECK (nfc_model IN ('NTAG213','NTAG215','NTAG216','CUSTOM')),
  write_mode              TEXT NOT NULL DEFAULT 'HUB'
                          CHECK (write_mode IN ('HUB','DIRECT')),
  custom_capacity_bytes   INTEGER,                   -- usado somente quando nfc_model = 'CUSTOM'
  direct_links_selected   TEXT NOT NULL DEFAULT '[]', -- JSON array, ex: '["mainLink","sacLink"]'
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_tags_tenant ON nfc_tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tags_tagid ON nfc_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
`);

// -----------------------------------------------------------------------
// MIGRAÇÃO LEVE
// -----------------------------------------------------------------------
// Garante que bancos já existentes (criados antes da feature de capacidade
// NFC) recebam as novas colunas sem perder dados. SQLite não suporta
// "ADD COLUMN IF NOT EXISTS" nativamente, então verificamos via PRAGMA.
// -----------------------------------------------------------------------
function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = columns.some((c) => c.name === column);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('nfc_tags', 'nfc_model', "TEXT NOT NULL DEFAULT 'NTAG213'");
ensureColumn('nfc_tags', 'write_mode', "TEXT NOT NULL DEFAULT 'HUB'");
ensureColumn('nfc_tags', 'custom_capacity_bytes', 'INTEGER');
ensureColumn('nfc_tags', 'direct_links_selected', "TEXT NOT NULL DEFAULT '[]'");

export default db;
