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
 * Logic: Display members where Member Type == "Cox"
 *        Show day as available (green) if they have ANY availability on that day
 *        Show day as unavailable (gray) ONLY if entire day is blocked (00:00-23:59)
 *        Only filter out a cox if ALL 7 days are completely unavailable
 */
export function useCoxingOverviewUnified(): UseCoxingOverviewResult {
  const { members, loading: membersLoading, error: membersError } = useMembers()
  const { availabilityMap, loading: availabilityLoading } = useAllRowerAvailability(members)

  const loading = membersLoading || availabilityLoading
  const error = membersError

  const coxes = useMemo(() => {
    if (loading || error) return []

    // Get unique member types to see what values exist
    const uniqueTypes = [...new Set(members.map(m => m.memberType).filter(Boolean))]

    // Filter members who have Cox Experience (these are the coxes)
    const coxMembers = members.filter(m => {
      // A member is a cox if they have any cox experience value
      return m.coxExperience && m.coxExperience.trim() !== ''
    })

    const coxOverviews: CoxOverview[] = coxMembers.map(member => {
      const nameParts = member.name.trim().split(' ')
      const initials = nameParts.length >= 2
        ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
        : member.name.substring(0, 2).toUpperCase()

      // Get unavailability data for this member
      const memberUnavailability = availabilityMap.get(member.id)

      // Create availability object
      // Default to available for all days
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

          // A day is ONLY unavailable if the ENTIRE day is blocked (00:00 to 23:59)
          // Any other scenario (no ranges, partial ranges) means they have some availability
          const isWholeDayUnavailable = unavailableRanges.length === 1 &&
            unavailableRanges[0].start === '00:00' &&
            unavailableRanges[0].end === '23:59'

          // Show as available unless the whole day is blocked
          availability[day as keyof CoxDayAvailability] = !isWholeDayUnavailable
        })
      }

      return {
        memberId: member.id,
        name: member.name,
        initials,
        availability
      }
    })

    // Only filter out coxes who are completely unavailable ALL week (all 7 days are 00:00-23:59)
    const availableCoxes = coxOverviews.filter(cox =>
      Object.values(cox.availability).some(isAvailable => isAvailable)
    )

    return availableCoxes.sort((a, b) => a.name.localeCompare(b.name))
  }, [members, availabilityMap, loading, error])

  return { coxes, loading, error }
}
