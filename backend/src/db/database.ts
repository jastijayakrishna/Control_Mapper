import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getDbPath(): string {
  if (process.env.VERCEL) return '/tmp/control-mapper.db';
  const dataDir = join(__dirname, '..', '..', 'data');
  mkdirSync(dataDir, { recursive: true });
  return join(dataDir, 'control-mapper.db');
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(getDbPath());
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS catalog_version (
  version TEXT PRIMARY KEY, published_at TEXT NOT NULL,
  published_by TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('draft','published','deprecated'))
);
CREATE TABLE IF NOT EXISTS requirement (
  id TEXT NOT NULL, catalog_version TEXT NOT NULL, statement TEXT NOT NULL, domain TEXT NOT NULL,
  applies_when TEXT NOT NULL, criticality INTEGER NOT NULL CHECK (criticality BETWEEN 1 AND 5),
  rationale TEXT NOT NULL, authoritative_source TEXT NOT NULL,
  PRIMARY KEY (id, catalog_version), FOREIGN KEY (catalog_version) REFERENCES catalog_version(version)
);
CREATE TABLE IF NOT EXISTS control (
  id TEXT NOT NULL, catalog_version TEXT NOT NULL, framework TEXT NOT NULL, ref TEXT NOT NULL,
  title TEXT NOT NULL, description TEXT NOT NULL, verifies_json TEXT NOT NULL, rationale TEXT NOT NULL,
  PRIMARY KEY (id, catalog_version), FOREIGN KEY (catalog_version) REFERENCES catalog_version(version)
);
CREATE TABLE IF NOT EXISTS customer_scope (
  customer_id TEXT PRIMARY KEY, facts_json TEXT NOT NULL, pinned_catalog_version TEXT NOT NULL,
  updated_at TEXT NOT NULL, FOREIGN KEY (pinned_catalog_version) REFERENCES catalog_version(version)
);
`;

export function initDb(): void {
  getDb().exec(SCHEMA);
}

export function isSeeded(): boolean {
  const row = getDb().prepare('SELECT COUNT(*) as cnt FROM catalog_version').get() as { cnt: number };
  return row.cnt > 0;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
