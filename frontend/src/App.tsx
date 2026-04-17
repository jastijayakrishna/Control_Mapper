import './index.css';
import { useMapping } from './hooks/useMapping';
import TopBar from './components/TopBar';
import ScopePanel from './components/ScopePanel';
import ControlList from './components/ControlList';
import ExplanationPanel from './components/ExplanationPanel';

export default function App() {
  const {
    scope, mapping, summary, selectedControl,
    loading, recomputing, error,
    toggleFact, selectControl, enabledCount,
  } = useMapping();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-0 flex-col gap-4">
        <div className="w-9 h-9 rounded-lg border border-primary flex items-center justify-center text-xs font-extrabold text-primary animate-pulse-slow shadow-[0_0_20px_rgba(0,232,123,0.15)]">
          CM
        </div>
        <p className="text-txt-ghost text-xs tracking-[0.04em]">Initializing...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-0 flex-col gap-3">
        <p className="text-danger text-[13px] font-semibold">{error}</p>
        <p className="text-txt-ghost text-[11px]">Backend must be running on port 3001.</p>
      </div>
    );
  }

  return (
    <>
      <TopBar summary={summary} enabledCount={enabledCount} recomputing={recomputing} />
      <main className="flex-1 flex overflow-hidden">
        <ScopePanel scope={scope} onToggle={toggleFact} enabledCount={enabledCount} />
        <ControlList
          controls={mapping?.controls || []}
          selectedControlId={selectedControl?.controlId || null}
          onSelect={selectControl}
          recomputing={recomputing}
        />
        <ExplanationPanel control={selectedControl} />
      </main>
    </>
  );
}
