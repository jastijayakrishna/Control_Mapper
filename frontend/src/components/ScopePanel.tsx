import type { ScopeFacts } from '../types';
import { SCOPE_FACT_CATEGORIES, SCOPE_FACT_LABELS, SCOPE_FACT_ICONS } from '../types';

interface ScopePanelProps {
  scope: ScopeFacts;
  onToggle: (fact: keyof ScopeFacts) => void;
  enabledCount: number;
}

export default function ScopePanel({ scope, onToggle, enabledCount }: ScopePanelProps) {
  return (
    <aside className="w-[280px] min-w-[280px] bg-surface-0 border-r border-edge flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-edge-subtle flex items-center justify-between">
        <span className="text-[11px] font-bold text-txt-3 tracking-[0.12em] uppercase">
          Scope
        </span>
        <span
          className={`text-[11px] font-semibold px-2.5 py-1 rounded-md tabular-nums border ${
            enabledCount > 0
              ? 'text-primary bg-primary/[0.06] border-primary/15'
              : 'text-[#666] bg-transparent border-edge'
          }`}
        >
          {enabledCount} active
        </span>
      </div>

      {/* Toggles */}
      <div className="flex-1 overflow-y-auto py-3">
        {Object.entries(SCOPE_FACT_CATEGORIES).map(([category, facts]) => (
          <div key={category} className="mb-2">
            <div className="px-6 pt-3 pb-2 text-[9px] font-bold text-txt-dim tracking-[0.14em] uppercase">
              {category}
            </div>
            {facts.map((fact) => {
              const isOn = scope[fact];
              return (
                <button
                  key={fact}
                  onClick={() => onToggle(fact)}
                  className={`flex items-center w-full py-2.5 px-6 border-none cursor-pointer gap-3 transition-colors duration-150 ${
                    isOn
                      ? 'bg-primary/[0.03] hover:bg-primary/[0.06]'
                      : 'bg-transparent hover:bg-surface-2'
                  }`}
                >
                  <span className={`text-sm w-5 text-center ${isOn ? 'opacity-100' : 'opacity-30'}`}>
                    {SCOPE_FACT_ICONS[fact]}
                  </span>
                  <span
                    className={`flex-1 text-left text-[13px] transition-colors duration-150 ${
                      isOn ? 'font-medium text-txt' : 'font-normal text-txt-muted'
                    }`}
                  >
                    {SCOPE_FACT_LABELS[fact]}
                  </span>
                  {/* Toggle switch */}
                  <div
                    className={`w-9 h-[18px] rounded-full relative shrink-0 transition-all duration-200 ease-spring border ${
                      isOn
                        ? 'bg-primary border-primary shadow-[0_0_8px_rgba(0,232,123,0.2)]'
                        : 'bg-edge border-[#2a2a2a]'
                    }`}
                  >
                    <div
                      className={`absolute top-[3px] w-3 h-3 rounded-full transition-all duration-200 ease-spring ${
                        isOn ? 'left-[18px] bg-surface-0' : 'left-[3px] bg-txt-faint'
                      }`}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-6 py-3.5 border-t border-edge-subtle text-[11px] text-txt-dim leading-relaxed">
        Toggle facts to recompute mappings in real-time.
      </div>
    </aside>
  );
}
