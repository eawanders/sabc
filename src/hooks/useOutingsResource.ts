// src/hooks/useOutingsResource.ts
"use client";

import { useEffect, useState, useCallback } from 'react';
import type { Outing } from '@/types/outing';

interface OutingsState {
  outings: Outing[];
  loading: boolean;
  error: string | null;
}

const CACHE_TTL_MS = 30_000;

let cachedOutings: Outing[] | null = null;
let cacheTimestamp = 0;
let inflightPromise: Promise<Outing[]> | null = null;

async function fetchOutings(): Promise<Outing[]> {
  const response = await fetch('/api/get-outings', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch outings: ${response.status}`);
  }

  const data = await response.json();
  return (data.outings ?? []) as Outing[];
}

function shouldUseCache() {
  if (!cachedOutings) return false;
  return Date.now() - cacheTimestamp < CACHE_TTL_MS;
}

async function loadOutings(force = false) {
  if (!force && shouldUseCache()) {
    return cachedOutings ?? [];
  }

  if (inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = fetchOutings()
    .then((outings) => {
      cachedOutings = outings;
      cacheTimestamp = Date.now();
      return outings;
    })
    .finally(() => {
      inflightPromise = null;
    });

  return inflightPromise;
}

export function useOutingsResource() {
  const [state, setState] = useState<OutingsState>(() => ({
    outings: cachedOutings ?? [],
    loading: !shouldUseCache(),
    error: null,
  }));

  useEffect(() => {
    let cancelled = false;

    if (shouldUseCache()) {
      setState({ outings: cachedOutings ?? [], loading: false, error: null });
      return;
    }

    loadOutings()
      .then((outings) => {
        if (cancelled) return;
        setState({ outings, loading: false, error: null });
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setState({ outings: [], loading: false, error: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    const outings = await loadOutings(true);
    setState({ outings, loading: false, error: null });
  }, []);

  return {
    outings: state.outings,
    loading: state.loading,
    error: state.error,
    refresh,
  };
}
