import { getDb } from './database.js';
import type { CatalogVersion, Requirement, Control, VerifiesEntry, ScopeFacts } from '../engine/types.js';

// ─── Catalog Queries ──────────────────────────────────────────────

export function getCatalogVersions(): CatalogVersion[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM catalog_version ORDER BY published_at DESC')
    .all() as {
    version: string;
    published_at: string;
    published_by: string;
    status: string;
  }[];

  return rows.map((r) => ({
    version: r.version,
    publishedAt: r.published_at,
    publishedBy: r.published_by,
    status: r.status as CatalogVersion['status'],
  }));
}

export function getRequirementsForVersion(version: string): Requirement[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM requirement WHERE catalog_version = ? ORDER BY id')
    .all(version) as {
    id: string;
    catalog_version: string;
    statement: string;
    domain: string;
    applies_when: string;
    criticality: number;
    rationale: string;
    authoritative_source: string;
  }[];

  return rows.map((r) => ({
    id: r.id,
    catalogVersion: r.catalog_version,
    statement: r.statement,
    domain: r.domain,
    appliesWhen: JSON.parse(r.applies_when),
    criticality: r.criticality,
    rationale: r.rationale,
    authoritativeSource: r.authoritative_source,
  }));
}

export function getControlsForVersion(version: string): Control[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM control WHERE catalog_version = ? ORDER BY ref')
    .all(version) as {
    id: string;
    catalog_version: string;
    framework: string;
    ref: string;
    title: string;
    description: string;
    verifies_json: string;
    rationale: string;
  }[];

  return rows.map((r) => ({
    id: r.id,
    catalogVersion: r.catalog_version,
    framework: r.framework,
    ref: r.ref,
    title: r.title,
    description: r.description,
    verifies: JSON.parse(r.verifies_json) as VerifiesEntry[],
    rationale: r.rationale,
  }));
}

// ─── Customer Queries ─────────────────────────────────────────────

export function getCustomerScope(customerId: string) {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM customer_scope WHERE customer_id = ?')
    .get(customerId) as
    | { customer_id: string; facts_json: string; pinned_catalog_version: string; updated_at: string }
    | undefined;

  if (!row) return null;

  return {
    customerId: row.customer_id,
    facts: JSON.parse(row.facts_json) as ScopeFacts,
    pinnedCatalogVersion: row.pinned_catalog_version,
    updatedAt: row.updated_at,
  };
}

export function upsertCustomerScope(
  customerId: string,
  facts: ScopeFacts,
  pinnedCatalogVersion: string
) {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR REPLACE INTO customer_scope (customer_id, facts_json, pinned_catalog_version, updated_at)
    VALUES (?, ?, ?, ?)
  `).run(customerId, JSON.stringify(facts), pinnedCatalogVersion, now);

  return { customerId, facts, pinnedCatalogVersion, updatedAt: now };
}
