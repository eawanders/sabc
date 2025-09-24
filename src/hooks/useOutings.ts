// src/hooks/useOutingState.ts
import { useState, useEffect, useCallback } from 'react';

interface OutingStateCache {
  [outingId: string]: {
    assignments: Record<string, string>;
    lastUpdated: number;
  };
}

const CACHE_KEY = 'outing-state-cache';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export function useOutingState(outingId: string) {
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [isInitialized, setIsInitialized] = useState(false);

  // Load cached state on mount
  useEffect(() => {
    const cached = loadCachedState(outingId);
    if (cached) {
      setAssignments(cached.assignments);
    }
    setIsInitialized(true);
    // Listen for cross-window storage events and custom events to keep multiple instances in sync
    function onStorage(e: StorageEvent) {
      if (e.key !== CACHE_KEY) return;
      const newCached = loadCachedState(outingId);
      if (newCached) setAssignments(newCached.assignments);
    }

    function onCustom(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.outingId === outingId) {
        setAssignments(detail.assignments);
      }
    }

    window.addEventListener('storage', onStorage);
    window.addEventListener('outing-state-updated', onCustom as EventListener);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('outing-state-updated', onCustom as EventListener);
    };
  }, [outingId]);

  // Save state to cache when it changes. Accept either a plain object or an updater function
  // so callers can use the functional form (prev => ({ ...prev, foo: 'bar' })).
  const updateAssignments = useCallback((newAssignmentsOrUpdater: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => {
    setAssignments(prev => {
      const resolved = typeof newAssignmentsOrUpdater === 'function'
        ? (newAssignmentsOrUpdater as (prev: Record<string, string>) => Record<string, string>)(prev)
        : newAssignmentsOrUpdater;
      // Persist the resolved assignments
      try {
        console.debug('[useOutingState] saving cached state for', outingId, resolved);
        saveCachedState(outingId, resolved);
      } catch (err) {
        console.error('❌ Error saving cached state:', err);
      }
      return resolved;
    });
  }, [outingId]);

  return {
    assignments,
    setAssignments: updateAssignments,
    isInitialized
  };
}

function loadCachedState(outingId: string): OutingStateCache[string] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const cacheData: OutingStateCache = JSON.parse(cached);
    const outingCache = cacheData[outingId];

    if (!outingCache) return null;

    // Check if cache is still valid
    const now = Date.now();
    if (now - outingCache.lastUpdated > CACHE_DURATION) {
      return null;
    }

    return outingCache;
  } catch (error) {
    console.error('❌ Error loading cached state:', error);
    return null;
  }
}

function saveCachedState(outingId: string, assignments: Record<string, string>) {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const cacheData: OutingStateCache = cached ? JSON.parse(cached) : {};

    cacheData[outingId] = {
      assignments,
      lastUpdated: Date.now()
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    // Log and dispatch a custom event so other hook instances in the same window can react immediately
    console.debug('[useOutingState] saveCachedState: wrote cache and dispatching outing-state-updated for', outingId);
    try {
      window.dispatchEvent(new CustomEvent('outing-state-updated', { detail: { outingId, assignments } }));
    } catch (err) {
      console.error('[useOutingState] dispatch failed for', outingId, err);
    }
  } catch (error) {
    console.error('❌ Error saving cached state:', error);
  }
}

export function clearOutingStateCache(outingId?: string) {
  try {
    if (outingId) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const cacheData: OutingStateCache = JSON.parse(cached);
        delete cacheData[outingId];
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      }
    } else {
      localStorage.removeItem(CACHE_KEY);
    }
  } catch (error) {
    console.error('❌ Error clearing cached state:', error);
  }
}
