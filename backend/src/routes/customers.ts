import { Router, Request, Response } from 'express';
import { getCustomerScope, upsertCustomerScope, getRequirementsForVersion, getControlsForVersion } from '../db/queries.js';
import { computeFullMapping, computeCoverageSummary } from '../engine/mapper.js';
import type { ScopeFacts } from '../engine/types.js';
import { DEFAULT_SCOPE_FACTS } from '../engine/types.js';

const router = Router();

// ─── POST /customers/:id/scope ────────────────────────────────────

router.post('/:id/scope', (req: Request, res: Response) => {
  const customerId = String(req.params.id);
  const body = req.body as { facts?: Partial<ScopeFacts>; pinnedCatalogVersion?: string };

  if (!body.facts || typeof body.facts !== 'object') {
    res.status(400).json({ error: 'Request body must include "facts" object' });
    return;
  }

  // Validate scope fact keys and values
  const validKeys = Object.keys(DEFAULT_SCOPE_FACTS);
  for (const [key, value] of Object.entries(body.facts)) {
    if (!validKeys.includes(key)) {
      res.status(400).json({ error: `Invalid scope fact: ${key}` });
      return;
    }
    if (typeof value !== 'boolean') {
      res.status(400).json({ error: `Scope fact "${key}" must be a boolean, got ${typeof value}` });
      return;
    }
  }

  const existingScope = getCustomerScope(customerId);
  const baseFacts = existingScope ? existingScope.facts : { ...DEFAULT_SCOPE_FACTS };
  const mergedFacts: ScopeFacts = { ...baseFacts, ...body.facts };
  const version = body.pinnedCatalogVersion || existingScope?.pinnedCatalogVersion || '2024.1';

  res.json(upsertCustomerScope(customerId, mergedFacts, version));
});

// ─── GET /customers/:id/scope ─────────────────────────────────────

router.get('/:id/scope', (req: Request, res: Response) => {
  const scope = getCustomerScope(String(req.params.id));
  if (!scope) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }
  res.json(scope);
});

// ─── GET /customers/:id/mapping ───────────────────────────────────

router.get('/:id/mapping', (req: Request, res: Response) => {
  const scope = getCustomerScope(String(req.params.id));
  if (!scope) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  const requirements = getRequirementsForVersion(scope.pinnedCatalogVersion);
  const controls = getControlsForVersion(scope.pinnedCatalogVersion);

  res.json(computeFullMapping(controls, requirements, scope.facts, scope.customerId, scope.pinnedCatalogVersion));
});

// ─── GET /customers/:id/coverage-summary ──────────────────────────

router.get('/:id/coverage-summary', (req: Request, res: Response) => {
  const scope = getCustomerScope(String(req.params.id));
  if (!scope) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  const requirements = getRequirementsForVersion(scope.pinnedCatalogVersion);
  const controls = getControlsForVersion(scope.pinnedCatalogVersion);

  const mapping = computeFullMapping(controls, requirements, scope.facts, scope.customerId, scope.pinnedCatalogVersion);
  res.json(computeCoverageSummary(mapping));
});

// ─── POST /customers/:id/compute ──────────────────────────────────
// Unified stateless endpoint: accepts the FULL scope, computes mapping
// + summary in a single atomic response. This eliminates the serverless
// race condition where parallel GET calls hit different instances.

router.post('/:id/compute', (req: Request, res: Response) => {
  const customerId = String(req.params.id);
  const body = req.body as { facts: ScopeFacts };

  if (!body.facts || typeof body.facts !== 'object') {
    res.status(400).json({ error: 'Request body must include "facts" object with all scope facts' });
    return;
  }

  // Validate all scope facts are present and boolean
  const validKeys = Object.keys(DEFAULT_SCOPE_FACTS);
  for (const key of validKeys) {
    if (typeof (body.facts as Record<string, unknown>)[key] !== 'boolean') {
      res.status(400).json({ error: `Missing or invalid scope fact: ${key}` });
      return;
    }
  }

  const scopeFacts = body.facts;
  const version = '2024.1';

  // Persist scope for consistency
  upsertCustomerScope(customerId, scopeFacts, version);

  // Compute mapping and summary in one atomic operation
  const requirements = getRequirementsForVersion(version);
  const controls = getControlsForVersion(version);
  const mapping = computeFullMapping(controls, requirements, scopeFacts, customerId, version);
  const summary = computeCoverageSummary(mapping);

  res.json({ scope: { customerId, facts: scopeFacts, pinnedCatalogVersion: version }, mapping, summary });
});

export default router;
