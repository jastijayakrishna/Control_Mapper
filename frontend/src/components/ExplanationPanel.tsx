import type { ControlMapping, RequirementExplanation } from '../types';

interface ExplanationPanelProps {
  control: ControlMapping | null;
}

export default function ExplanationPanel({ control }: ExplanationPanelProps) {
  if (!control) {
    return (
      <aside className="w-[440px] min-w-[440px] bg-surface-0 border-l border-edge flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-11 h-11 rounded-lg border border-edge flex items-center justify-center mx-auto mb-4 text-lg opacity-30">
            ◉
          </div>
          <p className="text-[13px] text-txt-dim leading-relaxed">
            Select a control to inspect provenance
          </p>
        </div>
      </aside>
    );
  }

  const ungrouped = control.explanation.filter((e) => !e.compensatingGroup);
  const groups = new Map<string, RequirementExplanation[]>();
  for (const exp of control.explanation) {
    if (exp.compensatingGroup) {
      const g = groups.get(exp.compensatingGroup) || [];
      g.push(exp);
      groups.set(exp.compensatingGroup, g);
    }
  }

  const coveragePct = Math.round(control.coverage * 100);
  const isFull = control.coverage >= 1;
  const isPartial = control.coverage > 0 && control.coverage < 1;

  const statusNarrative = (() => {
    if (control.status === 'NOT_APPLICABLE')
      return 'No requirements match the current scope.';
    if (control.status === 'FULLY_COVERED')
      return `All ${control.applicableCount} applicable requirements satisfied.`;
    if (control.status === 'GAPS')
      return 'Applicable requirements exist but none contribute coverage.';

    const missingFacts = new Set<string>();
    for (const exp of control.explanation) {
      if (!exp.applicable) {
        for (const ev of exp.scopeEvaluation) {
          if (!ev.satisfied) missingFacts.add(ev.label);
        }
      }
    }
    const list = [...missingFacts].slice(0, 3).join(', ');
    const extra = missingFacts.size > 3 ? ` (+${missingFacts.size - 3})` : '';
    return `${control.applicableCount}/${control.totalCount} applicable.${list ? ` Enable ${list}${extra} to increase.` : ''}`;
  })();

  return (
    <aside className="w-[440px] min-w-[440px] bg-surface-0 border-l border-edge flex flex-col overflow-hidden">
      {/* Header */}
      <div className="py-5 px-6 border-b border-edge-subtle">
        <div className="flex items-center gap-2.5 mb-2">
          <span className="text-[13px] font-bold text-primary font-mono">
            {control.controlRef}
          </span>
          <span className="text-[13px] font-semibold text-txt-2">
            {control.controlTitle}
          </span>
        </div>
        <p className="text-[11px] text-[#666] leading-relaxed mb-4">
          {control.controlDescription}
        </p>

        {/* Coverage */}
        <div className="py-3.5 px-4 rounded-lg bg-surface-2 border border-edge-subtle">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-[#666] tracking-[0.1em]">
              COVERAGE
            </span>
            <span
              className={`text-xl font-bold tabular-nums ${
                isFull ? 'text-primary' : isPartial ? 'text-amber' : 'text-txt-faint'
              }`}
            >
              {coveragePct}%
            </span>
          </div>
          <div className="h-1.5 rounded-sm bg-edge-subtle overflow-hidden mb-3">
            <div
              className={`h-full rounded-sm coverage-bar-fill ${
                isFull
                  ? 'bg-primary shadow-[0_0_8px_rgba(0,232,123,0.3)]'
                  : isPartial
                    ? 'bg-amber shadow-[0_0_8px_rgba(255,184,0,0.2)]'
                    : 'bg-txt-ghost'
              }`}
              style={{ width: `${coveragePct}%` }}
            />
          </div>
          <p className="text-[11px] text-txt-muted leading-relaxed">
            {statusNarrative}
          </p>
        </div>
      </div>

      {/* Requirements */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="text-[10px] font-bold text-txt-dim tracking-[0.14em] mb-3 px-1">
          PROVENANCE
        </div>

        {ungrouped.map((exp) => (
          <ReqCard key={exp.requirementId} exp={exp} />
        ))}

        {Array.from(groups.entries()).map(([groupName, members]) => (
          <div
            key={groupName}
            className="mt-3 rounded-lg border border-edge bg-surface-1 overflow-hidden"
          >
            <div className="px-4 py-2.5 border-b border-edge-subtle flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-primary">⚡</span>
                <span className="text-[10px] font-bold text-primary tracking-[0.08em]">
                  {groupName.toUpperCase()}
                </span>
              </div>
              <span className="text-[10px] text-txt-dim">MAX weight</span>
            </div>
            <div className="p-1.5">
              {members.map((exp) => (
                <ReqCard key={exp.requirementId} exp={exp} inGroup />
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function ReqCard({ exp, inGroup = false }: { exp: RequirementExplanation; inGroup?: boolean }) {
  const ok = exp.applicable;

  return (
    <div
      className={`fade-in py-3 px-3.5 rounded-lg border ${
        inGroup ? 'mb-1' : 'mb-2'
      } ${
        ok
          ? 'bg-primary/[0.02] border-primary/[0.08]'
          : 'bg-danger/[0.01] border-danger/[0.04]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={`text-[13px] w-4 text-center ${ok ? 'text-primary' : 'text-danger'}`}>
            {ok ? '\u2713' : '\u2717'}
          </span>
          <span className={`text-[11px] font-bold font-mono ${ok ? 'text-primary' : 'text-danger'}`}>
            {exp.requirementId}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {exp.contributed && (
            <span className="text-[9px] font-bold text-surface-0 bg-primary px-1.5 py-0.5 rounded tracking-[0.06em]">
              ACTIVE
            </span>
          )}
          <span className="text-[11px] font-medium text-[#666] font-mono">
            {exp.weight}
          </span>
        </div>
      </div>

      {/* Statement */}
      <p className={`text-[11px] leading-relaxed mb-2.5 ${ok ? 'text-txt-3' : 'text-txt-muted'}`}>
        {exp.statement}
      </p>

      {/* Condition trace */}
      {exp.scopeEvaluation && exp.scopeEvaluation.length > 0 && (
        <div className="py-2.5 px-3 rounded-md bg-surface-2 border border-edge-subtle">
          <div className="text-[10px] font-mono text-txt-faint mb-2 leading-snug">
            <span className="text-txt-dim">when </span>
            <span className="text-txt-3">{exp.conditionSummary}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            {exp.scopeEvaluation.map((ev) => (
              <div key={ev.fact} className="flex items-center gap-2 text-[11px]">
                <span
                  className={`w-1.5 h-1.5 rounded-[1px] shrink-0 ${
                    ev.satisfied
                      ? 'bg-primary shadow-[0_0_4px_rgba(0,232,123,0.3)]'
                      : 'bg-danger shadow-[0_0_4px_rgba(255,59,59,0.2)]'
                  }`}
                />
                <span className={ev.satisfied ? 'text-txt-3' : 'text-danger font-medium'}>
                  {ev.label}
                </span>
                {!ev.satisfied && (
                  <span className="text-[10px] text-txt-dim ml-auto">off</span>
                )}
              </div>
            ))}
          </div>

          <div
            className={`mt-2.5 pt-2 border-t border-edge-subtle text-[10px] font-semibold ${
              ok ? 'text-primary' : 'text-danger'
            }`}
          >
            {ok
              ? '\u2192 all conditions met'
              : `\u2192 excluded: ${exp.scopeEvaluation.filter((e) => !e.satisfied).map((e) => e.label).join(', ')}`}
          </div>
        </div>
      )}
    </div>
  );
}
