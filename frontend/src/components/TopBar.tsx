import type { CoverageSummary } from '../types';

interface TopBarProps {
  summary: CoverageSummary | null;
  enabledCount: number;
  recomputing: boolean;
}

export default function TopBar({ summary, recomputing }: TopBarProps) {
  return (
    <header className="bg-surface-0 border-b border-edge px-8 h-14 flex items-center justify-between shrink-0">
      {/* Left: Brand */}
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-lg border border-primary flex items-center justify-center text-[11px] font-extrabold text-primary tracking-[0.02em]">
          CM
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-[15px] font-bold text-txt tracking-[-0.03em]">
            Control Mapper
          </span>
          <span className="text-[11px] text-txt-muted font-medium tracking-[0.08em] uppercase">
            SOC 2 · Type II
          </span>
        </div>
      </div>

      {/* Center: Stats */}
      <div className="flex items-center gap-10">
        {summary && (
          <>
            <Stat label="CATALOG" value={`v${summary.catalogVersion}`} />
            <div className="w-px h-5 bg-edge" />
            <Stat
              label="REQUIREMENT REUSE"
              value={`${summary.uniqueRequirements} reqs \u2192 ${summary.applicableControls} controls`}
              accent
            />
            <div className="w-px h-5 bg-edge" />
            <Stat label="MAPPINGS" value={String(summary.totalMappings)} />
          </>
        )}
      </div>

      {/* Right: Status pills */}
      <div className="flex items-center gap-3">
        {recomputing && (
          <div className="flex items-center gap-2 text-[10px] text-primary font-semibold tracking-[0.04em]">
            <div className="w-[5px] h-[5px] rounded-full bg-primary animate-pulse-fast" />
            COMPUTING
          </div>
        )}
        {summary && (
          <div className="flex gap-1 px-2 py-1.5 rounded-lg bg-surface-2 border border-edge">
            <Pill count={summary.fullyCovered} label="COV" color="text-primary" />
            <Pill count={summary.partiallyCovered} label="PAR" color="text-amber" />
            <Pill count={summary.notApplicable} label="N/A" color="text-[#666]" />
            <Pill count={summary.gaps} label="GAP" color="text-danger" />
          </div>
        )}
      </div>
    </header>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] text-[#666] font-semibold tracking-[0.12em]">
        {label}
      </span>
      <span className={`text-[13px] tracking-[-0.01em] ${accent ? 'text-primary font-semibold' : 'text-txt-3 font-medium'}`}>
        {value}
      </span>
    </div>
  );
}

function Pill({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-1 px-2 py-0.5">
      <span className={`text-[13px] font-bold tabular-nums ${color}`}>
        {count}
      </span>
      <span className="text-[9px] text-[#666] font-semibold tracking-[0.06em]">
        {label}
      </span>
    </div>
  );
}
