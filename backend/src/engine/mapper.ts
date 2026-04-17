/**
 * Control Mapping Engine — Production Version
 * 
 * Features:
 * - Proxy-based scope fact tracing (no brittle AST parsing)
 * - Accurate theoretical maximum coverage calculation
 * - Compensating group logic (MAX weight per group)
 * - Full provenance with scopeEvaluation, excludedBy, and conditionSummary
 * - Pure function: no side effects, fully testable
 */

import jsonLogic from 'json-logic-js';
import type {
  Control,
  Requirement,
  ScopeFacts,
  ControlMapping,
  RequirementExplanation,
  CoverageStatus,
  MappingResult,
  CoverageSummary,
  ScopeFactEvaluation,
} from './types.js';
import { SCOPE_FACT_LABELS } from './types.js';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Trace which scope facts are accessed during jsonLogic evaluation.
 * Returns both the applicability result and the set of accessed fact names.
 */
function traceApplicability(
  logic: object,
  scope: ScopeFacts
): { applicable: boolean; accessedFacts: string[] } {
  const accessedFacts = new Set<string>();
  
  const proxyScope = new Proxy(scope as Record<string, unknown>, {
    get(target, prop: string) {
      if (prop in target) {
        accessedFacts.add(prop);
        return target[prop];
      }
      return undefined;
    },
  });

  const applicable = jsonLogic.apply(logic, proxyScope) === true;
  return { applicable, accessedFacts: Array.from(accessedFacts) };
}

/**
 * Generate a human-readable condition summary from a jsonLogic expression.
 * This is a simplified formatter that handles the subset used in our catalog.
 * For unsupported operators, it falls back to JSON string.
 */
function formatCondition(node: unknown): string {
  if (node === null || node === undefined) return '';
  if (typeof node !== 'object') return String(node);
  if (Array.isArray(node)) return node.map(formatCondition).join(', ');

  const obj = node as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== 1) return JSON.stringify(node);

  const op = keys[0];
  const args = obj[op];

  // var
  if (op === 'var') return String(args);

  // ==
  if (op === '==' && Array.isArray(args) && args.length === 2) {
    const [left, right] = args;
    if (typeof left === 'object' && left !== null && 'var' in (left as object)) {
      const varName = (left as Record<string, unknown>).var as string;
      if (right === true) return varName;
    }
    return `${formatCondition(left)} == ${formatCondition(right)}`;
  }

  // and
  if (op === 'and' && Array.isArray(args)) {
    return args.map(formatCondition).join(' AND ');
  }

  // or
  if (op === 'or' && Array.isArray(args)) {
    const inner = args.map(formatCondition).join(' OR ');
    return `(${inner})`;
  }

  // Fallback
  return JSON.stringify(node);
}

/**
 * Determine which facts are missing (required by condition but false in scope).
 * Uses the accessed facts from traceApplicability and assumes any accessed fact
 * that is false contributed to the condition failing.
 */
function findMissingFacts(accessedFacts: string[], scope: ScopeFacts): string[] {
  return accessedFacts.filter(fact => !(scope as Record<string, boolean>)[fact]);
}

/**
 * Calculate both actual coverage and theoretical maximum.
 * Respects compensating groups and caps at 1.0.
 */
function calculateCoverage(
  explanations: RequirementExplanation[]
): { actual: number; theoreticalMax: number } {
  const groups = new Map<string, RequirementExplanation[]>();
  const ungrouped: RequirementExplanation[] = [];

  for (const exp of explanations) {
    if (exp.compensatingGroup) {
      const group = groups.get(exp.compensatingGroup) || [];
      group.push(exp);
      groups.set(exp.compensatingGroup, group);
    } else {
      ungrouped.push(exp);
    }
  }

  // Actual score: only applicable requirements count
  let actual = ungrouped.reduce((sum, e) => sum + (e.applicable ? e.weight : 0), 0);
  for (const members of groups.values()) {
    const applicable = members.filter(m => m.applicable);
    if (applicable.length > 0) {
      actual += Math.max(...applicable.map(m => m.weight));
    }
  }

  // Theoretical max: assume all requirements could be applicable
  let theoreticalMax = ungrouped.reduce((sum, e) => sum + e.weight, 0);
  for (const members of groups.values()) {
    theoreticalMax += Math.max(...members.map(m => m.weight));
  }

  return {
    actual: Math.min(actual, 1.0),
    theoreticalMax: Math.min(theoreticalMax, 1.0),
  };
}

// ============================================================================
// Core Mapping Function
// ============================================================================

export function computeControlMapping(
  control: Control,
  requirementMap: Map<string, Requirement>,
  scope: ScopeFacts
): ControlMapping {
  const explanations: RequirementExplanation[] = [];

  // Phase 1: Evaluate applicability for each referenced requirement
  for (const entry of control.verifies) {
    const req = requirementMap.get(entry.requirementId);

    if (!req) {
      // Data integrity error – fail loudly
      throw new Error(
        `[ControlMapper] Requirement "${entry.requirementId}" referenced by Control "${control.id}" not found in catalog.`
      );
    }

    const { applicable, accessedFacts } = traceApplicability(req.appliesWhen, scope);
    const conditionSummary = formatCondition(req.appliesWhen);
    const excludedBy = applicable ? [] : findMissingFacts(accessedFacts, scope);
    const scopeEvaluation: ScopeFactEvaluation[] = accessedFacts.map(fact => ({
      fact,
      label: (SCOPE_FACT_LABELS as Record<string, string>)[fact] || fact,
      required: true, // In our boolean-only catalog, all accessed facts are required to be true
      actual: (scope as Record<string, boolean>)[fact] || false,
      satisfied: (scope as Record<string, boolean>)[fact] === true,
    }));

    explanations.push({
      requirementId: entry.requirementId,
      statement: req.statement,
      applicable,
      excludedBy,
      conditionSummary,
      scopeEvaluation,
      weight: entry.weight,
      compensatingGroup: entry.compensatingGroup,
      contributed: false, // Set in Phase 2
      effectiveWeight: 0,  // Set in Phase 2
    });
  }

  // Phase 2: Calculate coverage and mark contributions
  const { actual: coverage, theoreticalMax: maxCoverage } = calculateCoverage(explanations);

  // Mark which requirements actually contributed
  const groups = new Map<string, RequirementExplanation[]>();
  const ungrouped: RequirementExplanation[] = [];

  for (const exp of explanations) {
    if (exp.compensatingGroup) {
      const group = groups.get(exp.compensatingGroup) || [];
      group.push(exp);
      groups.set(exp.compensatingGroup, group);
    } else {
      ungrouped.push(exp);
    }
  }

  // Reset contributions
  explanations.forEach(e => {
    e.contributed = false;
    e.effectiveWeight = 0;
  });

  // Ungrouped: all applicable contribute their full weight
  ungrouped.filter(e => e.applicable).forEach(e => {
    e.contributed = true;
    e.effectiveWeight = e.weight;
  });

  // Grouped: only the highest-weight applicable member contributes
  for (const members of groups.values()) {
    const applicable = members.filter(m => m.applicable);
    if (applicable.length > 0) {
      const best = applicable.reduce((a, b) => (a.weight >= b.weight ? a : b));
      best.contributed = true;
      best.effectiveWeight = best.weight;
    }
  }

  // Phase 3: Determine status
  const applicableCount = explanations.filter(e => e.applicable).length;
  let status: CoverageStatus;

  if (applicableCount === 0) {
    status = 'NOT_APPLICABLE';
  } else if (coverage >= 1.0) {
    status = 'FULLY_COVERED';
  } else if (coverage > 0) {
    status = 'PARTIALLY_COVERED';
  } else {
    status = 'GAPS';
  }

  return {
    controlId: control.id,
    controlRef: control.ref,
    controlTitle: control.title,
    controlDescription: control.description,
    status,
    coverage: Math.round(coverage * 1000) / 1000,
    maxCoverage: Math.round(maxCoverage * 1000) / 1000,
    applicableCount,
    totalCount: explanations.length,
    explanation: explanations,
  };
}

// ============================================================================
// Full Mapping & Summary (unchanged from original)
// ============================================================================

export function computeFullMapping(
  controls: Control[],
  requirements: Requirement[],
  scope: ScopeFacts,
  customerId: string,
  catalogVersion: string
): MappingResult {
  const reqMap = new Map<string, Requirement>();
  for (const req of requirements) {
    reqMap.set(req.id, req);
  }

  const controlMappings = controls.map(ctrl =>
    computeControlMapping(ctrl, reqMap, scope)
  );

  return {
    customerId,
    catalogVersion,
    computedAt: new Date().toISOString(),
    controls: controlMappings,
  };
}

export function computeCoverageSummary(mappingResult: MappingResult): CoverageSummary {
  const controls = mappingResult.controls;

  const uniqueApplicableReqIds = new Set<string>();
  let totalMappings = 0;

  for (const ctrl of controls) {
    for (const exp of ctrl.explanation) {
      totalMappings++;
      if (exp.applicable) {
        uniqueApplicableReqIds.add(exp.requirementId);
      }
    }
  }

  return {
    customerId: mappingResult.customerId,
    catalogVersion: mappingResult.catalogVersion,
    totalControls: controls.length,
    applicableControls: controls.filter(c => c.status !== 'NOT_APPLICABLE').length,
    fullyCovered: controls.filter(c => c.status === 'FULLY_COVERED').length,
    partiallyCovered: controls.filter(c => c.status === 'PARTIALLY_COVERED').length,
    notApplicable: controls.filter(c => c.status === 'NOT_APPLICABLE').length,
    gaps: controls.filter(c => c.status === 'GAPS').length,
    uniqueRequirements: uniqueApplicableReqIds.size,
    totalMappings,
  };
}
