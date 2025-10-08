// src/hooks/useRowerAvailability.ts
import { useState, useEffect, useCallback } from 'react'
import { RowerWeeklyAvailability, TimeRange, DAYS_OF_WEEK } from '@/types/rowerAvailability'

interface UseRowerAvailabilityResult {
  availability: RowerWeeklyAvailability | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const availabilityCache = new Map<string, { data: RowerWeeklyAvailability; timestamp: number }>()
const CACHE_TTL_MS = 60_000 // 1 minute

async function fetchAvailability(memberId: string): Promise<RowerWeeklyAvailability> {
  const response = await fetch(`/api/get-rower-availability?memberId=${memberId}`)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch rower availability')
  }

  return data.availability
}

/**
 * Hook for fetching rower availability data for a specific member
 */
export function useRowerAvailability(memberId: string | null | undefined): UseRowerAvailabilityResult {
  const [availability, setAvailability] = useState<RowerWeeklyAvailability | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAvailability = useCallback(async (id: string, force = false) => {
    const cached = availabilityCache.get(id)

    if (!force && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setAvailability(cached.data)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await fetchAvailability(id)
      availabilityCache.set(id, { data, timestamp: Date.now() })
      setAvailability(data)
    } catch (err) {
      console.error('Error fetching rower availability:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setAvailability(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const refetch = useCallback(async () => {
    if (memberId) {
      await loadAvailability(memberId, true)
    }
  }, [memberId, loadAvailability])

  useEffect(() => {
    if (!memberId) {
      setAvailability(null)
      setLoading(false)
      setError(null)
      return
    }

    loadAvailability(memberId)
  }, [memberId, loadAvailability])

  return { availability, loading, error, refetch }
}

/**
 * Get empty/default availability object for a member
 */
export function getEmptyAvailability(memberId: string): RowerWeeklyAvailability {
  const empty: RowerWeeklyAvailability = {
    memberId,
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: []
  }
  return empty
}
