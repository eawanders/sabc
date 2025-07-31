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
      console.log(`🔄 Loaded cached state for outing ${outingId}:`, cached.assignments);
    }
    setIsInitialized(true);
  }, [outingId]);

  // Save state to cache when it changes
  const updateAssignments = useCallback((newAssignments: Record<string, string>) => {
    setAssignments(newAssignments);
    saveCachedState(outingId, newAssignments);
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
