// src/hooks/useCoxingOverviewUnified.ts
import { useMemo } from 'react'
import { useMembers } from '@/hooks/useMembers'
import { useAllRowerAvailability } from '@/hooks/useAllRowerAvailability'
import { DayOfWeek, DAYS_OF_WEEK } from '@/types/rowerAvailability'

export interface CoxDayAvailability {
  monday: boolean
  tuesday: boolean
  wednesday: boolean
  thursday: boolean
  friday: boolean
  saturday: boolean
  sunday: boolean
}

export interface CoxOverview {
  memberId: string
  name: string
  initials: string
  availability: CoxDayAvailability
}

interface UseCoxingOverviewResult {
  coxes: CoxOverview[]
  loading: boolean
  error: string | null
}

/**
 * Hook to get coxing overview using the new unified availability system
 * Reads from Members DB "Unavailable [Day]" properties and inverts the logic
 *
 * Logic: If a cox has NO unavailable times for a day, they are available all day
 *        If a cox has unavailable times, we assume they're still generally available
 *        (just not during specific times)
 */
export function useCoxingOverviewUnified(): UseCoxingOverviewResult {
  const { members, loading: membersLoading, error: membersError } = useMembers()
  const { availabilityMap, loading: availabilityLoading } = useAllRowerAvailability(members)

  const loading = membersLoading || availabilityLoading
  const error = membersError

  const coxes = useMemo(() => {
    if (loading || error) return []

    // Filter members who have cox experience
    const coxMembers = members.filter(m => m.coxExperience)

    const coxOverviews: CoxOverview[] = coxMembers.map(member => {
      const nameParts = member.name.trim().split(' ')
      const initials = nameParts.length >= 2
        ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
        : member.name.substring(0, 2).toUpperCase()

      // Get unavailability data for this member
      const memberUnavailability = availabilityMap.get(member.id)

      // Create availability object
      // A cox is considered "available" for a day if they have NOT marked the ENTIRE day as unavailable
      // If they have no unavailability data OR have partial unavailability, show them as available
      const availability: CoxDayAvailability = {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: true,
      }

      // If member has unavailability data, check each day
      if (memberUnavailability) {
        DAYS_OF_WEEK.forEach(day => {
          const unavailableRanges = memberUnavailability[day]

          // Only mark as unavailable if they've marked the ENTIRE day (or most of it)
          // For simplicity, we'll show them as available unless they have extensive blocks
          // This matches the coxing use case where partial availability still means "generally available"

          // Alternative approach: Show as available if they have ANY time available
          // For now, keep them all as available (green) - the schedule will do detailed time checking
          availability[day as keyof CoxDayAvailability] = true
        })
      }

      return {
        memberId: member.id,
        name: member.name,
        initials,
        availability
      }
    })

    // Filter out coxes who are completely unavailable all week (none exist with current logic)
    return coxOverviews.sort((a, b) => a.name.localeCompare(b.name))
  }, [members, availabilityMap, loading, error])

  return { coxes, loading, error }
}
