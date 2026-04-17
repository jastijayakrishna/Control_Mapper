/**
 * Control Mapping Engine — Pure Mapping Function
 *
 * This is the core of the architecture. Given a Control, a set of Requirements,
 * and a customer's ScopeFacts, this function computes:
 * 1. Which Requirements are applicable (via jsonLogic evaluation of appliesWhen)
 * 2. The coverage score (respecting compensating groups and weight capping)
 * 3. Full provenance explanation for every Requirement referenced by the Control
 *
 * This function is PURE: no side effects, no database access, no network calls.
 * Same inputs → identical output.
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

// ─── Condition Formatting ─────────────────────────────────────────
// Converts a jsonLogic expression into a human-readable string like:
//   "(hasAws OR hasAzure OR hasGcp) AND hasProduction AND hasOkta"

function formatCondition(node: unknown): string {
  if (node === null || node === undefined) return '';
  if (typeof node !== 'object') return String(node);
  if (Array.isArray(node)) return node.map(formatCondition).join(', ');

  const obj = node as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== 1) return JSON.stringify(node);

  const op = keys[0];
  const args = obj[op];

  // Variable reference: { "var": "hasAws" } → "hasAws"
  if (op === 'var') return String(args);

  // Equality check: { "==": [{ "var": "hasAws" }, true] } → "hasAws"
  if (op === '==' && Array.isArray(args) && args.length === 2) {
    const [left, right] = args;
    if (typeof left === 'object' && left !== null && 'var' in (left as Record<string, unknown>)) {
      const varName = (left as Record<string, unknown>)['var'] as string;
      if (right === true) return varName;
    }
    return `${formatCondition(left)} == ${formatCondition(right)}`;
  }

  // AND: { "and": [...] } → "X AND Y AND Z"
  if (op === 'and' && Array.isArray(args)) {
    return args.map(formatCondition).join(' AND ');
  }

  // OR: { "or": [...] } → "(X OR Y OR Z)"
  if (op === 'or' && Array.isArray(args)) {
    const inner = args.map(formatCondition).join(' OR ');
    return `(${inner})`;
  }

  // Fallback
  if (Array.isArray(args)) {
    return `${op}(${args.map(formatCondition).join(', ')})`;
  }
  return JSON.stringify(node);
}

// ─── Scope Fact Evaluation ─────────────────────────────────────────
// Walks the jsonLogic tree and produces a per-fact evaluation trace.
// For each scope fact referenced by the condition, shows:
//   - The fact name and human-readable label
//   - Whether the condition requires it to be true
//   - The actual value in the current scope
//   - Whether it's satisfied

function evaluateScopeFacts(
  appliesWhen: object,
  scope: ScopeFacts
): ScopeFactEvaluation[] {
  const evaluations: ScopeFactEvaluation[] = [];
  const scopeRecord = scope as unknown as Record<string, boolean>;
  const seen = new Set<string>();

  function walk(node: unknown): void {
    if (node === null || node === undefined) return;
    if (typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }

    const obj = node as Record<string, unknown>;
    const keys = Object.keys(obj);

    if (keys.length === 1) {
      const op = keys[0];
      const args = obj[op];

      if (op === '==' && Array.isArray(args) && args.length === 2) {
        const [left, right] = args;
        if (
          typeof left === 'object' &&
          left !== null &&
          'var' in (left as Record<string, unknown>)
        ) {
          const varName = (left as Record<string, unknown>)['var'] as string;
          if (right === true && varName in scopeRecord && !seen.has(varName)) {
            seen.add(varName);
            const label = (SCOPE_FACT_LABELS as Record<string, string>)[varName] || varName;
            evaluations.push({
              fact: varName,
              label,
              required: true,
              actual: scopeRecord[varName],
              satisfied: scopeRecord[varName] === true,
            });
          }
        }
      } else if (Array.isArray(args)) {
        for (const arg of args) walk(arg);
      } else {
        walk(args);
      }
    }
  }

  walk(appliesWhen);
  return evaluations;
}

// ─── Legacy helper (still used for excludedBy array) ──────────────

function findMissingScopeFacts(
  appliesWhen: object,
  scope: ScopeFacts
): string[] {
  const evals = evaluateScopeFacts(appliesWhen, scope);
  return evals.filter((e) => !e.satisfied).map((e) => e.fact);
}

// ─── Single Control Mapping ───────────────────────────────────────

export function computeControlMapping(
  control: Control,
  requirementMap: Map<string, Requirement>,
  scope: ScopeFacts
): ControlMapping {
  const explanations: RequirementExplanation[] = [];

  // Phase 1: Evaluate applicability of each referenced requirement
  for (const entry of control.verifies) {
    const req = requirementMap.get(entry.requirementId);

    if (!req) {
      explanations.push({
        requirementId: entry.requirementId,
        statement: `[MISSING REQUIREMENT: ${entry.requirementId}]`,
        applicable: false,
        excludedBy: ['requirement-not-found'],
        conditionSummary: 'N/A',
        scopeEvaluation: [],
        weight: entry.weight,
        compensatingGroup: entry.compensatingGroup,
        contributed: false,
        effectiveWeight: 0,
      });
      continue;
    }

    const applicable = jsonLogic.apply(req.appliesWhen, scope) === true;
    const excludedBy = applicable ? [] : findMissingScopeFacts(req.appliesWhen, scope);
    const conditionSummary = formatCondition(req.appliesWhen);
    const scopeEvaluation = evaluateScopeFacts(req.appliesWhen, scope);

    explanations.push({
      requirementId: entry.requirementId,
      statement: req.statement,
      applicable,
      excludedBy,
      conditionSummary,
      scopeEvaluation,
      weight: entry.weight,
      compensatingGroup: entry.compensatingGroup,
      contributed: false, // will be set in Phase 2
      effectiveWeight: 0, // will be set in Phase 2
    });
  }

  // Phase 2: Compute coverage
  // Group by compensatingGroup
  const ungrouped: RequirementExplanation[] = [];
  const groups = new Map<string, RequirementExplanation[]>();

  for (const exp of explanations) {
    if (exp.compensatingGroup) {
      const group = groups.get(exp.compensatingGroup) || [];
      group.push(exp);
      groups.set(exp.compensatingGroup, group);
    } else {
      ungrouped.push(exp);
    }
  }

  let totalCoverage = 0;

  // Ungrouped: sum weights of applicable requirements
  for (const exp of ungrouped) {
    if (exp.applicable) {
      exp.contributed = true;
      exp.effectiveWeight = exp.weight;
      totalCoverage += exp.weight;
    }
  }

  // Grouped: take MAX weight among applicable members of each group
  for (const [, members] of groups) {
    const applicableMembers = members.filter((m) => m.applicable);
    if (applicableMembers.length > 0) {
      let maxWeight = 0;
      let maxMember: RequirementExplanation | null = null;
      for (const member of applicableMembers) {
        if (member.weight > maxWeight) {
          maxWeight = member.weight;
          maxMember = member;
        }
      }
      if (maxMember) {
        maxMember.contributed = true;
        maxMember.effectiveWeight = maxWeight;
        totalCoverage += maxWeight;
      }
      for (const member of applicableMembers) {
        if (member !== maxMember) {
          member.effectiveWeight = 0;
        }
      }
    }
  }

  // Cap at 1.0
  totalCoverage = Math.min(totalCoverage, 1.0);

  // Phase 3: Determine status
  const applicableCount = explanations.filter((e) => e.applicable).length;
  const totalCount = explanations.length;

  let status: CoverageStatus;
  if (applicableCount === 0) {
    status = 'NOT_APPLICABLE';
  } else if (totalCoverage >= 1.0) {
    status = 'FULLY_COVERED';
  } else if (totalCoverage > 0) {
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
    coverage: Math.round(totalCoverage * 1000) / 1000,
    maxCoverage: 1.0,
    applicableCount,
    totalCount,
    explanation: explanations,
  };
}

// ─── Full Mapping Result ──────────────────────────────────────────

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

  const controlMappings = controls.map((ctrl) =>
    computeControlMapping(ctrl, reqMap, scope)
  );

  return {
    customerId,
    catalogVersion,
    computedAt: new Date().toISOString(),
    controls: controlMappings,
  };
}

// ─── Coverage Summary ─────────────────────────────────────────────

export function computeCoverageSummary(
  mappingResult: MappingResult
): CoverageSummary {
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
    applicableControls: controls.filter((c) => c.status !== 'NOT_APPLICABLE').length,
    fullyCovered: controls.filter((c) => c.status === 'FULLY_COVERED').length,
    partiallyCovered: controls.filter((c) => c.status === 'PARTIALLY_COVERED').length,
    notApplicable: controls.filter((c) => c.status === 'NOT_APPLICABLE').length,
    gaps: controls.filter((c) => c.status === 'GAPS').length,
    uniqueRequirements: uniqueApplicableReqIds.size,
    totalMappings,
  };
}
