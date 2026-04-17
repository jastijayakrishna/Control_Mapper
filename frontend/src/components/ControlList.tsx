import { useState } from 'react';
import type { ControlMapping, CoverageStatus } from '../types';

interface ControlListProps {
  controls: ControlMapping[];
  selectedControlId: string | null;
  onSelect: (controlId: string) => void;
  recomputing: boolean;
}

const STATUS_CONFIG: Record<
  CoverageStatus,
  { label: string; text: string; bg: string; border: string }
> = {
  FULLY_COVERED: {
    label: 'COVERED',
    text: 'text-primary',
    bg: 'bg-primary/[0.06]',
    border: 'border-primary/20',
  },
  PARTIALLY_COVERED: {
    label: 'PARTIAL',
    text: 'text-amber',
    bg: 'bg-amber/[0.06]',
    border: 'border-amber/15',
  },
  NOT_APPLICABLE: {
    label: 'N/A',
    text: 'text-txt-faint',
    bg: 'bg-txt-faint/[0.06]',
    border: 'border-txt-faint/15',
  },
  GAPS: {
    label: 'GAP',
    text: 'text-danger',
    bg: 'bg-danger/[0.06]',
    border: 'border-danger/15',
  },
};

const BAR_COLORS: Record<CoverageStatus, string> = {
  FULLY_COVERED: 'bg-primary',
  PARTIALLY_COVERED: 'bg-amber',
  NOT_APPLICABLE: 'bg-edge',
  GAPS: 'bg-danger',
};

const BAR_SHADOWS: Record<CoverageStatus, string> = {
  FULLY_COVERED: 'shadow-[0_0_6px_rgba(0,232,123,0.25)]',
  PARTIALLY_COVERED: 'shadow-[0_0_6px_rgba(255,184,0,0.25)]',
  NOT_APPLICABLE: '',
  GAPS: 'shadow-[0_0_6px_rgba(255,59,59,0.25)]',
};

export default function ControlList({
  controls,
  selectedControlId,
  onSelect,
  recomputing,
}: ControlListProps) {
  const [showAll, setShowAll] = useState(false);

  const applicableControls = controls.filter((c) => c.status !== 'NOT_APPLICABLE');
  const naCount = controls.length - applicableControls.length;
  const displayControls =
    showAll || applicableControls.length === 0 ? controls : applicableControls;

  return (
    <section className="flex-1 flex flex-col overflow-hidden bg-surface-1 min-w-0">
      {/* Header */}
      <div className="px-6 py-4 border-b border-edge flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-txt-3 tracking-[0.12em] uppercase">
            Controls
          </span>
          <span className="text-[11px] text-txt-dim tabular-nums">
            {displayControls.length}/{controls.length}
          </span>
        </div>

        {naCount > 0 && applicableControls.length > 0 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className={`text-[11px] font-medium px-3 py-1 rounded-md cursor-pointer transition-all duration-150 tracking-[0.02em] bg-transparent border ${
              showAll
                ? 'text-primary border-primary/20 hover:border-primary/30'
                : 'text-txt-muted border-edge hover:border-primary/30 hover:text-primary'
            }`}
          >
            {showAll ? `Hide ${naCount} N/A` : `+${naCount} N/A`}
          </button>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {displayControls.map((ctrl) => {
          const isSelected = selectedControlId === ctrl.controlId;
          const config = STATUS_CONFIG[ctrl.status];
          const pct = Math.round(ctrl.coverage * 100);

          return (
            <button
              key={ctrl.controlId}
              id={`control-${ctrl.controlRef}`}
              onClick={() => onSelect(ctrl.controlId)}
              className={`flex flex-col gap-2.5 py-4 px-5 rounded-lg text-left w-full cursor-pointer transition-all duration-200 ease-spring border ${
                recomputing ? 'recomputing' : ''
              } ${
                isSelected
                  ? 'border-primary bg-primary/[0.03] shadow-[0_0_12px_rgba(0,232,123,0.06)]'
                  : 'border-edge-subtle bg-surface-2 hover:bg-surface-3 hover:border-[#222]'
              }`}
            >
              {/* Top: Ref + Title + Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xs font-bold text-primary font-mono shrink-0">
                    {ctrl.controlRef}
                  </span>
                  <span className="text-[13px] font-medium text-txt-2 overflow-hidden text-ellipsis whitespace-nowrap">
                    {ctrl.controlTitle}
                  </span>
                </div>
                <span
                  className={`text-[9px] font-bold ${config.text} ${config.bg} ${config.border} border py-0.5 px-2 rounded tracking-[0.1em] shrink-0 ml-3`}
                >
                  {config.label}
                </span>
              </div>

              {/* Bar + Pct */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1 rounded-sm bg-edge-subtle overflow-hidden">
                  <div
                    className={`h-full rounded-sm coverage-bar-fill ${BAR_COLORS[ctrl.status]} ${ctrl.coverage > 0 ? BAR_SHADOWS[ctrl.status] : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`text-[11px] font-semibold ${config.text} tabular-nums min-w-8 text-right`}>
                  {pct}%
                </span>
              </div>

              {/* Req count */}
              <span className="text-[11px] text-txt-dim">
                {ctrl.applicableCount}/{ctrl.totalCount} requirements applicable
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
