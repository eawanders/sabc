// src/app/(app shell)/hooks/useCoxingAvailability.ts

import { useState, useEffect, useCallback } from 'react'
import { CoxingAvailability } from '@/types/coxing'

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  data: CoxingAvailability[];
  timestamp: number;
}

const availabilityCache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<CoxingAvailability[]>>();

function getCacheKey(startDate?: string, endDate?: string) {
  return `${startDate ?? ''}|${endDate ?? ''}`;
}

async function fetchAvailability(startDate?: string, endDate?: string): Promise<CoxingAvailability[]> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const response = await fetch(`/api/get-coxing-availability?${params.toString()}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch Coxing availability');
  }

  return (data.availability ?? []) as CoxingAvailability[];
}

async function loadAvailability(startDate?: string, endDate?: string, force = false) {
  const key = getCacheKey(startDate, endDate);
  const cached = availabilityCache.get(key);

  if (!force && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  if (inflightRequests.has(key)) {
    return inflightRequests.get(key)!;
  }

  const request = fetchAvailability(startDate, endDate)
    .then((availability) => {
      availabilityCache.set(key, { data: availability, timestamp: Date.now() });
      return availability;
    })
    .finally(() => {
      inflightRequests.delete(key);
    });

  inflightRequests.set(key, request);
  return request;
}

/**
 * Hook for fetching and managing Coxing availability data
 */
export function useCoxingAvailability(startDate?: string, endDate?: string) {
  const [availability, setAvailability] = useState<CoxingAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch availability data
  useEffect(() => {
    let cancelled = false

    setLoading(true)
    setError(null)

    loadAvailability(startDate, endDate)
      .then((data) => {
        if (cancelled) return
        setAvailability(data)
        setLoading(false)
      })
      .catch((err: Error) => {
        if (cancelled) return
        console.error('Error fetching Coxing availability:', err)
        setError(err.message)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [startDate, endDate])

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await loadAvailability(startDate, endDate, true)
      setAvailability(data)
    } catch (err) {
      console.error('Error fetching Coxing availability:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  return {
    availability,
    loading,
    error,
    refetch,
    setAvailability,
  }
}
