import type { ScopeFacts, MappingResult, CoverageSummary } from './types';

const API_BASE = '/api';
const CUSTOMER_ID = 'demo-customer';

/** Response from the unified /compute endpoint */
export interface ComputeResponse {
  scope: {
    customerId: string;
    facts: ScopeFacts;
    pinnedCatalogVersion: string;
  };
  mapping: MappingResult;
  summary: CoverageSummary;
}

/**
 * Unified compute endpoint — sends the FULL scope and receives
 * mapping + summary in a single atomic response.
 * Eliminates serverless race conditions from parallel GET calls.
 */
export async function computeMapping(facts: ScopeFacts): Promise<ComputeResponse> {
  const res = await fetch(`${API_BASE}/customers/${CUSTOMER_ID}/compute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ facts }),
  });
  if (!res.ok) throw new Error(`Failed to compute mapping: ${res.statusText}`);
  return res.json();
}

/**
 * Get the current scope from the server (used for initial load only).
 * Falls back to a full compute if scope is not found (cold start).
 */
export async function getInitialState(defaultFacts: ScopeFacts): Promise<ComputeResponse> {
  // Try to get existing scope first
  try {
    const scopeRes = await fetch(`${API_BASE}/customers/${CUSTOMER_ID}/scope`);
    if (scopeRes.ok) {
      const scopeData = await scopeRes.json();
      // Now do a unified compute with the existing scope to get mapping + summary atomically
      return computeMapping(scopeData.facts);
    }
  } catch {
    // Fall through to default
  }

  // No existing scope or error — compute with defaults
  return computeMapping(defaultFacts);
}
