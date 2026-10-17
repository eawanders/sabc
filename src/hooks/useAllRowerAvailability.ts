// src/hooks/useAllRowerAvailability.ts
import { useState, useEffect, useCallback } from 'react'
import { RowerWeeklyAvailability, DayOfWeek, TimeRange } from '@/types/rowerAvailability'

type AvailabilityMap = Map<string, Record<DayOfWeek, TimeRange[]>>

interface UseAllRowerAvailabilityResult {
  availabilityMap: AvailabilityMap
  loading: boolean
  // Set when availability could not be loaded: it is then unknown, not "available"
  error: string | null
  refetch: () => Promise<void>
}

let globalCache: { map: AvailabilityMap; timestamp: number } | null = null
let inFlight: Promise<AvailabilityMap> | null = null
const CACHE_TTL_MS = 60_000 // 1 minute

function toDays(availability: RowerWeeklyAvailability): Record<DayOfWeek, TimeRange[]> {
  return {
    monday: availability.monday,
    tuesday: availability.tuesday,
    wednesday: availability.wednesday,
    thursday: availability.thursday,
    friday: availability.friday,
    saturday: availability.saturday,
    sunday: availability.sunday
  }
}

function getFreshCache(): AvailabilityMap | null {
  return globalCache && Date.now() - globalCache.timestamp < CACHE_TTL_MS ? globalCache.map : null
}

/**
 * Replace a member's cached availability (e.g. after saving it)
 */
export function setCachedMemberAvailability(data: RowerWeeklyAvailability): void {
  globalCache?.map.set(data.memberId, toDays(data))
}

async function fetchAllAvailability(): Promise<AvailabilityMap> {
  const response = await fetch('/api/get-all-rower-availability')
  const data = await response.json()

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch rower availability')
  }

  const map: AvailabilityMap = new Map()
  for (const availability of data.availability as RowerWeeklyAvailability[]) {
    map.set(availability.memberId, toDays(availability))
  }
  return map
}

/**
 * Load every member's availability with ONE request, shared by all callers:
 * served from cache within the TTL and deduped while a request is in flight.
 * Rejects on failure (nothing is cached), so callers never mistake a failed
 * load for "everyone available".
 */
export function loadAllRowerAvailability(force = false): Promise<AvailabilityMap> {
  const cached = force ? null : getFreshCache()
  if (cached) return Promise.resolve(cached)
  if (inFlight && !force) return inFlight

  const request = fetchAllAvailability()
    .then((map) => {
      globalCache = { map, timestamp: Date.now() }
      return map
    })
    .finally(() => {
      if (inFlight === request) inFlight = null
    })
  inFlight = request
  return request
}

/**
 * Hook to fetch rower availability for all members
 */
export function useAllRowerAvailability(): UseAllRowerAvailabilityResult {
  const [availabilityMap, setAvailabilityMap] = useState<AvailabilityMap>(() => getFreshCache() ?? new Map())
  const [loading, setLoading] = useState(() => getFreshCache() === null)
  const [error, setError] = useState<string | null>(null)

  const loadAvailability = useCallback(async (force = false) => {
    if (force || !getFreshCache()) setLoading(true)
    setError(null)

    try {
      setAvailabilityMap(await loadAllRowerAvailability(force))
    } catch (err) {
      console.error('Error fetching rower availability:', err)
      setAvailabilityMap(new Map())
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const refetch = useCallback(async () => {
    await loadAvailability(true)
  }, [loadAvailability])

  useEffect(() => {
    loadAvailability()
  }, [loadAvailability])

  return { availabilityMap, loading, error, refetch }
}
