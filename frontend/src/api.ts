import type { ScopeFacts, MappingResult, CoverageSummary } from './types';

const API_BASE = '/api';
const CUSTOMER_ID = 'demo-customer';

export async function updateScope(facts: Partial<ScopeFacts>): Promise<{
  customerId: string;
  facts: ScopeFacts;
  pinnedCatalogVersion: string;
  updatedAt: string;
}> {
  const res = await fetch(`${API_BASE}/customers/${CUSTOMER_ID}/scope`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ facts }),
  });
  if (!res.ok) throw new Error(`Failed to update scope: ${res.statusText}`);
  return res.json();
}

export async function getScope(): Promise<{
  customerId: string;
  facts: ScopeFacts;
  pinnedCatalogVersion: string;
  updatedAt: string;
}> {
  const res = await fetch(`${API_BASE}/customers/${CUSTOMER_ID}/scope`);
  if (!res.ok) throw new Error(`Failed to get scope: ${res.statusText}`);
  return res.json();
}

export async function getMapping(): Promise<MappingResult> {
  const res = await fetch(`${API_BASE}/customers/${CUSTOMER_ID}/mapping`);
  if (!res.ok) throw new Error(`Failed to get mapping: ${res.statusText}`);
  return res.json();
}

export async function getCoverageSummary(): Promise<CoverageSummary> {
  const res = await fetch(`${API_BASE}/customers/${CUSTOMER_ID}/coverage-summary`);
  if (!res.ok) throw new Error(`Failed to get coverage summary: ${res.statusText}`);
  return res.json();
}
