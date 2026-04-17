// Use the asm.js build of sql.js — no WASM binary needed, works everywhere including Vercel serverless
import initSqlJs from 'sql.js/dist/sql-asm.js';

type SqlJsDatabase = ReturnType<Awaited<ReturnType<typeof initSqlJs>>['Database']['prototype']['constructor']> & {
  run(sql: string, params?: unknown[]): unknown;
  exec(sql: string): { columns: string[]; values: unknown[][] }[];
  prepare(sql: string): {
    bind(params?: unknown[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    free(): boolean;
  };
  close(): void;
};

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;
let db: SqlJsDatabase | null = null;

/** Must be called once before any DB access */
export async function ensureInit(): Promise<void> {
  if (!SQL) {
    SQL = await initSqlJs();
  }
}

export function getDb(): SqlJsDatabase {
  if (!SQL) throw new Error('Call ensureInit() before using the database');
  if (!db) db = new SQL.Database() as SqlJsDatabase;
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
  getDb().run(SCHEMA);
}

export function isSeeded(): boolean {
  const rows = getDb().exec('SELECT COUNT(*) as cnt FROM catalog_version');
  return rows.length > 0 && (rows[0].values[0][0] as number) > 0;
}

// ─── Query helpers ──────────────────────────────────────────────────

export function dbAll(sql: string, params: unknown[] = []): Record<string, unknown>[] {
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  const results: Record<string, unknown>[] = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

export function dbGet(sql: string, params: unknown[] = []): Record<string, unknown> | undefined {
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  const result = stmt.step() ? stmt.getAsObject() : undefined;
  stmt.free();
  return result as Record<string, unknown> | undefined;
}

export function dbRun(sql: string, params: unknown[] = []): void {
  getDb().run(sql, params);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
