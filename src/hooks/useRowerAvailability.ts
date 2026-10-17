// src/hooks/useRowerAvailability.ts
import { useState, useEffect, useCallback, useRef } from 'react'
import { RowerWeeklyAvailability, TimeRange, DAYS_OF_WEEK } from '@/types/rowerAvailability'
import { setCachedMemberAvailability } from '@/hooks/useAllRowerAvailability'

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
 * Fresh cached availability for a member, or null if absent or older than the TTL
 */
export function getCachedAvailability(memberId: string): RowerWeeklyAvailability | null {
  const cached = availabilityCache.get(memberId)
  return cached && Date.now() - cached.timestamp < CACHE_TTL_MS ? cached.data : null
}

/**
 * Write a just-saved week into this hook's cache and the all-members cache,
 * so re-selecting the member within the TTL shows what was saved
 */
export function cacheSavedAvailability(data: RowerWeeklyAvailability): void {
  availabilityCache.set(data.memberId, { data, timestamp: Date.now() })
  setCachedMemberAvailability(data)
}

interface AvailabilitySetters {
  setAvailability: (availability: RowerWeeklyAvailability | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

/**
 * Load a member's availability into state. `isCurrent` is checked after the fetch:
 * if the member is no longer selected the response is dropped, so a slow reply for
 * one member can never populate another member's form.
 */
export async function loadRowerAvailability(
  id: string,
  force: boolean,
  isCurrent: () => boolean,
  { setAvailability, setLoading, setError }: AvailabilitySetters
): Promise<void> {
  const cached = force ? null : getCachedAvailability(id)

  if (cached) {
    setAvailability(cached)
    setError(null)
    setLoading(false)
    return
  }

  setLoading(true)
  setError(null)

  try {
    const data = await fetchAvailability(id)
    availabilityCache.set(id, { data, timestamp: Date.now() })
    if (!isCurrent()) return
    setAvailability(data)
  } catch (err) {
    console.error('Error fetching rower availability:', err)
    if (!isCurrent()) return
    setError(err instanceof Error ? err.message : 'Unknown error')
    setAvailability(null)
  } finally {
    if (isCurrent()) setLoading(false)
  }
}

/**
 * Whether the availability form can be shown and saved: only when the selected
 * member's own data has loaded without error. Otherwise the grid would be empty
 * (or another member's) and saving would overwrite the real values.
 */
export function canEditAvailability({
  selectedMemberId,
  availability,
  localAvailability,
  loading,
  fetchError
}: {
  selectedMemberId: string | null | undefined
  availability: RowerWeeklyAvailability | null
  localAvailability: RowerWeeklyAvailability | null
  loading: boolean
  fetchError: string | null
}): boolean {
  if (!selectedMemberId || loading || fetchError) return false
  if (!availability || !localAvailability) return false
  return availability.memberId === selectedMemberId && localAvailability.memberId === selectedMemberId
}

/**
 * Hook for fetching rower availability data for a specific member
 */
export function useRowerAvailability(memberId: string | null | undefined): UseRowerAvailabilityResult {
  const [availability, setAvailability] = useState<RowerWeeklyAvailability | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentMemberIdRef = useRef(memberId)

  const loadAvailability = useCallback(async (id: string, force = false) => {
    await loadRowerAvailability(id, force, () => currentMemberIdRef.current === id, {
      setAvailability,
      setLoading,
      setError
    })
  }, [])

  const refetch = useCallback(async () => {
    if (memberId) {
      await loadAvailability(memberId, true)
    }
  }, [memberId, loadAvailability])

  useEffect(() => {
    currentMemberIdRef.current = memberId

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
