import { describe, it, expect } from 'vitest';
import { computeControlMapping, computeFullMapping, computeCoverageSummary } from './mapper.js';
import type { Control, Requirement, ScopeFacts } from './types.js';
import { DEFAULT_SCOPE_FACTS } from './types.js';

// ─── Test Helpers ─────────────────────────────────────────────────

function makeReq(
  id: string,
  appliesWhen: object,
  statement = `Test requirement ${id}`
): Requirement {
  return {
    id,
    catalogVersion: 'test-v1',
    statement,
    domain: 'Test',
    appliesWhen,
    criticality: 3,
    rationale: 'Test rationale',
    authoritativeSource: 'Test source',
  };
}

function makeControl(
  id: string,
  verifies: { requirementId: string; weight: number; compensatingGroup?: string }[]
): Control {
  return {
    id,
    catalogVersion: 'test-v1',
    framework: 'SOC2',
    ref: 'CC-TEST',
    title: 'Test Control',
    description: 'Test description',
    verifies,
    rationale: 'Test rationale',
  };
}

function makeReqMap(reqs: Requirement[]): Map<string, Requirement> {
  const map = new Map<string, Requirement>();
  for (const req of reqs) map.set(req.id, req);
  return map;
}

const EMPTY_SCOPE: ScopeFacts = { ...DEFAULT_SCOPE_FACTS };

const FULL_SCOPE: ScopeFacts = {
  hasAws: true,
  hasAzure: true,
  hasGcp: true,
  hasProduction: true,
  hasAdminUsers: true,
  hasOkta: true,
  hasGithub: true,
  hasEncryptionAtRest: true,
  hasEncryptionInTransit: true,
  hasLogging: true,
  hasAlertMonitoring: true,
  hasIncidentResponse: true,
  hasRootAccountMfa: true,
  hasRootAccountSsoOnly: true,
};

// ─── Tests ────────────────────────────────────────────────────────

describe('computeControlMapping', () => {
  it('1. Empty scope → NOT_APPLICABLE when all requirements need scope facts', () => {
    const req = makeReq('R1', { '==': [{ var: 'hasAws' }, true] });
    const ctrl = makeControl('C1', [{ requirementId: 'R1', weight: 1.0 }]);
    const result = computeControlMapping(ctrl, makeReqMap([req]), EMPTY_SCOPE);

    expect(result.status).toBe('NOT_APPLICABLE');
    expect(result.coverage).toBe(0);
    expect(result.applicableCount).toBe(0);
    expect(result.explanation[0].applicable).toBe(false);
    expect(result.explanation[0].excludedBy).toContain('hasAws');
  });

  it('2. Full scope → FULLY_COVERED when all requirements apply and weights sum to ≥ 1.0', () => {
    const reqs = [
      makeReq('R1', { '==': [{ var: 'hasAws' }, true] }),
      makeReq('R2', { '==': [{ var: 'hasProduction' }, true] }),
    ];
    const ctrl = makeControl('C1', [
      { requirementId: 'R1', weight: 0.6 },
      { requirementId: 'R2', weight: 0.4 },
    ]);
    const result = computeControlMapping(ctrl, makeReqMap(reqs), FULL_SCOPE);

    expect(result.status).toBe('FULLY_COVERED');
    expect(result.coverage).toBe(1.0);
    expect(result.applicableCount).toBe(2);
  });

  it('3. Compensating group — all entries apply → takes MAX, not sum', () => {
    const reqs = [
      makeReq('R1', { '==': [{ var: 'hasAws' }, true] }),
      makeReq('R2', { '==': [{ var: 'hasAws' }, true] }),
    ];
    const ctrl = makeControl('C1', [
      { requirementId: 'R1', weight: 0.3, compensatingGroup: 'group-A' },
      { requirementId: 'R2', weight: 0.5, compensatingGroup: 'group-A' },
    ]);
    const scope: ScopeFacts = { ...EMPTY_SCOPE, hasAws: true };
    const result = computeControlMapping(ctrl, makeReqMap(reqs), scope);

    // Should be 0.5 (MAX), not 0.8 (sum)
    expect(result.coverage).toBe(0.5);
    const r1 = result.explanation.find((e) => e.requirementId === 'R1')!;
    const r2 = result.explanation.find((e) => e.requirementId === 'R2')!;
    expect(r2.contributed).toBe(true);
    expect(r2.effectiveWeight).toBe(0.5);
    expect(r1.contributed).toBe(false);
    expect(r1.effectiveWeight).toBe(0);
  });

  it('4. Compensating group — only one entry applies → uses that one', () => {
    const reqs = [
      makeReq('R1', { '==': [{ var: 'hasRootAccountMfa' }, true] }),
      makeReq('R2', { '==': [{ var: 'hasRootAccountSsoOnly' }, true] }),
    ];
    const ctrl = makeControl('C1', [
      { requirementId: 'R1', weight: 0.25, compensatingGroup: 'root-protection' },
      { requirementId: 'R2', weight: 0.25, compensatingGroup: 'root-protection' },
    ]);
    const scope: ScopeFacts = { ...EMPTY_SCOPE, hasRootAccountMfa: true };
    const result = computeControlMapping(ctrl, makeReqMap(reqs), scope);

    expect(result.coverage).toBe(0.25);
    const r1 = result.explanation.find((e) => e.requirementId === 'R1')!;
    const r2 = result.explanation.find((e) => e.requirementId === 'R2')!;
    expect(r1.applicable).toBe(true);
    expect(r1.contributed).toBe(true);
    expect(r2.applicable).toBe(false);
    expect(r2.excludedBy).toContain('hasRootAccountSsoOnly');
  });

  it('5. Partial coverage → correct percentage', () => {
    const reqs = [
      makeReq('R1', { '==': [{ var: 'hasAws' }, true] }),
      makeReq('R2', { '==': [{ var: 'hasGithub' }, true] }),
      makeReq('R3', { '==': [{ var: 'hasOkta' }, true] }),
    ];
    const ctrl = makeControl('C1', [
      { requirementId: 'R1', weight: 0.4 },
      { requirementId: 'R2', weight: 0.3 },
      { requirementId: 'R3', weight: 0.3 },
    ]);
    const scope: ScopeFacts = { ...EMPTY_SCOPE, hasAws: true };
    const result = computeControlMapping(ctrl, makeReqMap(reqs), scope);

    expect(result.status).toBe('PARTIALLY_COVERED');
    expect(result.coverage).toBe(0.4);
    expect(result.applicableCount).toBe(1);
  });

  it('6. Zero applicable requirements → NOT_APPLICABLE status (not GAPS)', () => {
    const reqs = [
      makeReq('R1', {
        and: [{ '==': [{ var: 'hasAzure' }, true] }, { '==': [{ var: 'hasGcp' }, true] }],
      }),
    ];
    const ctrl = makeControl('C1', [{ requirementId: 'R1', weight: 1.0 }]);
    const scope: ScopeFacts = { ...EMPTY_SCOPE, hasAws: true };
    const result = computeControlMapping(ctrl, makeReqMap(reqs), scope);

    expect(result.status).toBe('NOT_APPLICABLE');
    expect(result.applicableCount).toBe(0);
  });

  it('7. Weight capping at 1.0 — coverage never exceeds 1.0', () => {
    const reqs = [
      makeReq('R1', { '==': [{ var: 'hasAws' }, true] }),
      makeReq('R2', { '==': [{ var: 'hasAws' }, true] }),
      makeReq('R3', { '==': [{ var: 'hasAws' }, true] }),
    ];
    const ctrl = makeControl('C1', [
      { requirementId: 'R1', weight: 0.5 },
      { requirementId: 'R2', weight: 0.5 },
      { requirementId: 'R3', weight: 0.5 },
    ]);
    const scope: ScopeFacts = { ...EMPTY_SCOPE, hasAws: true };
    const result = computeControlMapping(ctrl, makeReqMap(reqs), scope);

    expect(result.coverage).toBe(1.0);
    expect(result.status).toBe('FULLY_COVERED');
  });

  it('8. Explanation provenance correctness — excluded requirements cite the right missing scope fact', () => {
    const reqs = [
      makeReq('R1', {
        and: [
          { '==': [{ var: 'hasAws' }, true] },
          { '==': [{ var: 'hasAdminUsers' }, true] },
          { '==': [{ var: 'hasProduction' }, true] },
        ],
      }),
    ];
    const ctrl = makeControl('C1', [{ requirementId: 'R1', weight: 1.0 }]);
    const scope: ScopeFacts = { ...EMPTY_SCOPE, hasAws: true };
    const result = computeControlMapping(ctrl, makeReqMap(reqs), scope);

    expect(result.explanation[0].applicable).toBe(false);
    expect(result.explanation[0].excludedBy).toContain('hasAdminUsers');
    expect(result.explanation[0].excludedBy).toContain('hasProduction');
    expect(result.explanation[0].excludedBy).not.toContain('hasAws');
  });

  it('9. Mixed grouped and ungrouped entries compute correctly', () => {
    const reqs = [
      makeReq('R1', { '==': [{ var: 'hasAws' }, true] }),
      makeReq('R2', { '==': [{ var: 'hasAws' }, true] }),
      makeReq('R3', { '==': [{ var: 'hasAws' }, true] }),
    ];
    const ctrl = makeControl('C1', [
      { requirementId: 'R1', weight: 0.4 },
      { requirementId: 'R2', weight: 0.3, compensatingGroup: 'grp' },
      { requirementId: 'R3', weight: 0.5, compensatingGroup: 'grp' },
    ]);
    const scope: ScopeFacts = { ...EMPTY_SCOPE, hasAws: true };
    const result = computeControlMapping(ctrl, makeReqMap(reqs), scope);

    expect(result.coverage).toBe(0.9);
    expect(result.status).toBe('PARTIALLY_COVERED');
  });

  it('10. Missing requirement in map produces safe fallback with contributed=false', () => {
    const ctrl = makeControl('C1', [{ requirementId: 'NONEXISTENT', weight: 1.0 }]);
    const result = computeControlMapping(ctrl, new Map(), FULL_SCOPE);

    expect(result.status).toBe('NOT_APPLICABLE');
    expect(result.explanation[0].applicable).toBe(false);
    expect(result.explanation[0].statement).toContain('MISSING');
  });

  it('11. Condition summary is human-readable', () => {
    const req = makeReq('R1', {
      and: [
        { or: [{ '==': [{ var: 'hasAws' }, true] }, { '==': [{ var: 'hasAzure' }, true] }] },
        { '==': [{ var: 'hasProduction' }, true] },
      ],
    });
    const ctrl = makeControl('C1', [{ requirementId: 'R1', weight: 1.0 }]);
    const result = computeControlMapping(ctrl, makeReqMap([req]), FULL_SCOPE);

    expect(result.explanation[0].conditionSummary).toBe(
      '(hasAws OR hasAzure) AND hasProduction'
    );
  });

  it('12. Scope evaluation trace shows per-fact ✅/❌ status', () => {
    const req = makeReq('R1', {
      and: [
        { '==': [{ var: 'hasAws' }, true] },
        { '==': [{ var: 'hasOkta' }, true] },
        { '==': [{ var: 'hasProduction' }, true] },
      ],
    });
    const ctrl = makeControl('C1', [{ requirementId: 'R1', weight: 1.0 }]);
    const scope: ScopeFacts = { ...EMPTY_SCOPE, hasAws: true, hasProduction: true };
    const result = computeControlMapping(ctrl, makeReqMap([req]), scope);

    const evalTrace = result.explanation[0].scopeEvaluation;
    expect(evalTrace).toHaveLength(3);

    const awsEval = evalTrace.find((e) => e.fact === 'hasAws')!;
    expect(awsEval.satisfied).toBe(true);
    expect(awsEval.actual).toBe(true);

    const oktaEval = evalTrace.find((e) => e.fact === 'hasOkta')!;
    expect(oktaEval.satisfied).toBe(false);
    expect(oktaEval.actual).toBe(false);
    expect(oktaEval.label).toBe('Okta SSO');

    const prodEval = evalTrace.find((e) => e.fact === 'hasProduction')!;
    expect(prodEval.satisfied).toBe(true);
  });
});

describe('computeFullMapping', () => {
  it('produces a MappingResult with all controls', () => {
    const reqs = [makeReq('R1', { '==': [{ var: 'hasAws' }, true] })];
    const ctrls = [
      makeControl('C1', [{ requirementId: 'R1', weight: 1.0 }]),
      makeControl('C2', [{ requirementId: 'R1', weight: 0.5 }]),
    ];
    const result = computeFullMapping(ctrls, reqs, FULL_SCOPE, 'cust-1', 'v1');

    expect(result.customerId).toBe('cust-1');
    expect(result.catalogVersion).toBe('v1');
    expect(result.controls).toHaveLength(2);
    expect(result.controls[0].status).toBe('FULLY_COVERED');
    expect(result.controls[1].status).toBe('PARTIALLY_COVERED');
  });
});

describe('computeCoverageSummary', () => {
  it('correctly counts statuses and dedup stats', () => {
    const reqs = [
      makeReq('R1', { '==': [{ var: 'hasAws' }, true] }),
      makeReq('R2', { '==': [{ var: 'hasGithub' }, true] }),
    ];
    const ctrls = [
      makeControl('C1', [
        { requirementId: 'R1', weight: 0.6 },
        { requirementId: 'R2', weight: 0.4 },
      ]),
      makeControl('C2', [{ requirementId: 'R2', weight: 1.0 }]),
    ];
    const scope: ScopeFacts = { ...EMPTY_SCOPE, hasAws: true };
    const mapping = computeFullMapping(ctrls, reqs, scope, 'cust-1', 'v1');
    const summary = computeCoverageSummary(mapping);

    expect(summary.totalControls).toBe(2);
    expect(summary.partiallyCovered).toBe(1);
    expect(summary.notApplicable).toBe(1);
    expect(summary.uniqueRequirements).toBe(1);
    expect(summary.totalMappings).toBe(3);
  });
});
