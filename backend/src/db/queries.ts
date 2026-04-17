import { dbAll, dbGet, dbRun } from './database.js';
import type { CatalogVersion, Requirement, Control, VerifiesEntry, ScopeFacts } from '../engine/types.js';

export function getCatalogVersions(): CatalogVersion[] {
  const rows = dbAll('SELECT * FROM catalog_version ORDER BY published_at DESC');
  return rows.map((r) => ({
    version: r.version as string,
    publishedAt: r.published_at as string,
    publishedBy: r.published_by as string,
    status: r.status as CatalogVersion['status'],
  }));
}

export function getRequirementsForVersion(version: string): Requirement[] {
  const rows = dbAll('SELECT * FROM requirement WHERE catalog_version = ? ORDER BY id', [version]);
  return rows.map((r) => ({
    id: r.id as string,
    catalogVersion: r.catalog_version as string,
    statement: r.statement as string,
    domain: r.domain as string,
    appliesWhen: JSON.parse(r.applies_when as string),
    criticality: r.criticality as number,
    rationale: r.rationale as string,
    authoritativeSource: r.authoritative_source as string,
  }));
}

export function getControlsForVersion(version: string): Control[] {
  const rows = dbAll('SELECT * FROM control WHERE catalog_version = ? ORDER BY ref', [version]);
  return rows.map((r) => ({
    id: r.id as string,
    catalogVersion: r.catalog_version as string,
    framework: r.framework as string,
    ref: r.ref as string,
    title: r.title as string,
    description: r.description as string,
    verifies: JSON.parse(r.verifies_json as string) as VerifiesEntry[],
    rationale: r.rationale as string,
  }));
}

export function getCustomerScope(customerId: string) {
  const row = dbGet('SELECT * FROM customer_scope WHERE customer_id = ?', [customerId]);
  if (!row) return null;
  return {
    customerId: row.customer_id as string,
    facts: JSON.parse(row.facts_json as string) as ScopeFacts,
    pinnedCatalogVersion: row.pinned_catalog_version as string,
    updatedAt: row.updated_at as string,
  };
}

export function upsertCustomerScope(customerId: string, facts: ScopeFacts, pinnedCatalogVersion: string) {
  const now = new Date().toISOString();
  dbRun(
    'INSERT OR REPLACE INTO customer_scope (customer_id, facts_json, pinned_catalog_version, updated_at) VALUES (?, ?, ?, ?)',
    [customerId, JSON.stringify(facts), pinnedCatalogVersion, now]
  );
  return { customerId, facts, pinnedCatalogVersion, updatedAt: now };
}
