// src/hooks/useAllRowerAvailability.ts
import { useState, useEffect, useCallback } from 'react'
import { RowerWeeklyAvailability, DayOfWeek, TimeRange } from '@/types/rowerAvailability'
import { Member } from '@/types/members'

interface UseAllRowerAvailabilityResult {
  availabilityMap: Map<string, Record<DayOfWeek, TimeRange[]>>
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const globalCache = new Map<string, { data: RowerWeeklyAvailability; timestamp: number }>()
const CACHE_TTL_MS = 60_000 // 1 minute

async function fetchMemberAvailability(memberId: string): Promise<RowerWeeklyAvailability | null> {
  try {
    const response = await fetch(`/api/get-rower-availability?memberId=${memberId}`)
    const data = await response.json()

    if (!response.ok || !data.success) {
      // If member has no availability data, return null (they're available)
      return null
    }

    return data.availability
  } catch (err) {
    console.error(`Failed to fetch availability for member ${memberId}:`, err)
    return null
  }
}

/**
 * Hook to fetch rower availability for all members
 */
export function useAllRowerAvailability(members: Member[]): UseAllRowerAvailabilityResult {
  const [availabilityMap, setAvailabilityMap] = useState<Map<string, Record<DayOfWeek, TimeRange[]>>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAllAvailability = useCallback(async (memberList: Member[], force = false) => {
    if (memberList.length === 0) {
      setAvailabilityMap(new Map())
      return
    }

    setLoading(true)
    setError(null)

    try {
      const newMap = new Map<string, Record<DayOfWeek, TimeRange[]>>()

      // Fetch availability for each member
      await Promise.all(
        memberList.map(async (member) => {
          // Check cache first
          const cached = globalCache.get(member.id)
          let availability: RowerWeeklyAvailability | null = null

          if (!force && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
            availability = cached.data
          } else {
            availability = await fetchMemberAvailability(member.id)
            if (availability) {
              globalCache.set(member.id, { data: availability, timestamp: Date.now() })
            }
          }

          // Only add to map if member has availability data
          if (availability) {
            newMap.set(member.id, {
              monday: availability.monday,
              tuesday: availability.tuesday,
              wednesday: availability.wednesday,
              thursday: availability.thursday,
              friday: availability.friday,
              saturday: availability.saturday,
              sunday: availability.sunday
            })
          }
        })
      )

      setAvailabilityMap(newMap)
    } catch (err) {
      console.error('Error fetching rower availability:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const refetch = useCallback(async () => {
    await loadAllAvailability(members, true)
  }, [members, loadAllAvailability])

  useEffect(() => {
    loadAllAvailability(members)
  }, [members, loadAllAvailability])

  return { availabilityMap, loading, error, refetch }
}
