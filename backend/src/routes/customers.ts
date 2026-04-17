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

  if (!body.facts) {
    res.status(400).json({ error: 'Request body must include "facts" object' });
    return;
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

export default router;
