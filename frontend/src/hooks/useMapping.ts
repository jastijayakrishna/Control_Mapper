import { useState, useEffect, useCallback, useRef } from 'react';
import type { ScopeFacts, MappingResult, CoverageSummary, ControlMapping } from '../types';
import { DEFAULT_SCOPE_FACTS } from '../types';
import { computeMapping, getInitialState } from '../api';

export function useMapping() {
  const [scope, setScope] = useState<ScopeFacts>({ ...DEFAULT_SCOPE_FACTS });
  const [mapping, setMapping] = useState<MappingResult | null>(null);
  const [summary, setSummary] = useState<CoverageSummary | null>(null);
  const [selectedControl, setSelectedControl] = useState<ControlMapping | null>(null);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recomputeTimer = useRef<number | null>(null);
  // Guard against stale responses from out-of-order network calls
  const requestCounter = useRef(0);

  // Initial load — single atomic call
  useEffect(() => {
    async function init() {
      try {
        const result = await getInitialState({ ...DEFAULT_SCOPE_FACTS });
        setScope(result.scope.facts);
        setMapping(result.mapping);
        setSummary(result.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Toggle a single scope fact — single atomic call with full scope
  const toggleFact = useCallback(
    async (fact: keyof ScopeFacts) => {
      const newValue = !scope[fact];
      const newScope = { ...scope, [fact]: newValue };

      // Optimistic UI update
      setScope(newScope);
      setRecomputing(true);

      if (recomputeTimer.current) {
        clearTimeout(recomputeTimer.current);
      }

      // Track this request to ignore stale responses
      const thisRequest = ++requestCounter.current;

      try {
        // Single atomic call — sends full scope, gets mapping + summary together
        const result = await computeMapping(newScope);

        // Only apply if this is still the latest request
        if (thisRequest !== requestCounter.current) return;

        setMapping(result.mapping);
        setSummary(result.summary);

        // Update selected control if one is selected
        if (selectedControl) {
          const updated = result.mapping.controls.find(
            (c) => c.controlId === selectedControl.controlId
          );
          setSelectedControl(updated || null);
        }
      } catch (err) {
        if (thisRequest !== requestCounter.current) return;
        // Rollback on error
        setScope(scope);
        setError(err instanceof Error ? err.message : 'Failed to recompute');
      } finally {
        if (thisRequest === requestCounter.current) {
          recomputeTimer.current = window.setTimeout(() => {
            setRecomputing(false);
          }, 150);
        }
      }
    },
    [scope, selectedControl]
  );

  const selectControl = useCallback(
    (controlId: string) => {
      if (mapping) {
        const ctrl = mapping.controls.find((c) => c.controlId === controlId);
        setSelectedControl(ctrl || null);
      }
    },
    [mapping]
  );

  const enabledCount = Object.values(scope).filter(Boolean).length;

  return {
    scope,
    mapping,
    summary,
    selectedControl,
    loading,
    recomputing,
    error,
    toggleFact,
    selectControl,
    enabledCount,
  };
}
