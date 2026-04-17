import { useState, useEffect, useCallback, useRef } from 'react';
import type { ScopeFacts, MappingResult, CoverageSummary, ControlMapping } from '../types';
import { DEFAULT_SCOPE_FACTS } from '../types';
import { getScope, updateScope, getMapping, getCoverageSummary } from '../api';

export function useMapping() {
  const [scope, setScope] = useState<ScopeFacts>({ ...DEFAULT_SCOPE_FACTS });
  const [mapping, setMapping] = useState<MappingResult | null>(null);
  const [summary, setSummary] = useState<CoverageSummary | null>(null);
  const [selectedControl, setSelectedControl] = useState<ControlMapping | null>(null);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recomputeTimer = useRef<number | null>(null);

  // Initial load
  useEffect(() => {
    async function init() {
      try {
        const [scopeRes, mappingRes, summaryRes] = await Promise.all([
          getScope(),
          getMapping(),
          getCoverageSummary(),
        ]);
        setScope(scopeRes.facts);
        setMapping(mappingRes);
        setSummary(summaryRes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Toggle a single scope fact
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

      try {
        // Update scope, then fetch new mapping + summary in parallel
        await updateScope({ [fact]: newValue });
        const [newMapping, newSummary] = await Promise.all([
          getMapping(),
          getCoverageSummary(),
        ]);

        setMapping(newMapping);
        setSummary(newSummary);

        // Update selected control if one is selected
        if (selectedControl) {
          const updated = newMapping.controls.find(
            (c) => c.controlId === selectedControl.controlId
          );
          setSelectedControl(updated || null);
        }
      } catch (err) {
        // Rollback on error
        setScope(scope);
        setError(err instanceof Error ? err.message : 'Failed to recompute');
      } finally {
        recomputeTimer.current = window.setTimeout(() => {
          setRecomputing(false);
        }, 150);
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
