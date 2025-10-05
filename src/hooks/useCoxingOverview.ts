// src/hooks/useCoxingOverview.ts
import { useMemo } from 'react'
import { getWeekStart, getWeekEnd } from '@/lib/date'
import { useMembers } from '@/hooks/useMembers'
import { useCoxingAvailability } from '@/app/(app shell)/hooks/useCoxingAvailability'

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

export function useCoxingOverview(): UseCoxingOverviewResult {
  const today = useMemo(() => new Date(), [])
  const weekStart = useMemo(() => getWeekStart(today).toISOString().split('T')[0], [today])
  const weekEnd = useMemo(() => getWeekEnd(today).toISOString().split('T')[0], [today])

  const { members, loading: membersLoading, error: membersError } = useMembers()
  const { availability, loading: availabilityLoading, error: availabilityError } = useCoxingAvailability(weekStart, weekEnd)

  const loading = membersLoading || availabilityLoading
  const error = membersError || availabilityError

  const coxes = useMemo(() => {
    if (loading || error) return []

    const coxMap = new Map<string, CoxOverview>()

    availability.forEach((day) => {
      const date = new Date(day.date)
      const dayOfWeek = date.getDay()

      const allMemberIds = new Set([
        ...day.earlyAM,
        ...day.midAM,
        ...day.midPM,
        ...day.latePM,
      ])

      allMemberIds.forEach((memberId) => {
        if (!coxMap.has(memberId)) {
          const member = members.find((m) => m.id === memberId)
          if (!member) return

          const nameParts = member.name.trim().split(' ')
          const initials = nameParts.length >= 2
            ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
            : member.name.substring(0, 2).toUpperCase()

          coxMap.set(memberId, {
            memberId,
            name: member.name,
            initials,
            availability: {
              monday: false,
              tuesday: false,
              wednesday: false,
              thursday: false,
              friday: false,
              saturday: false,
              sunday: false,
            },
          })
        }

        const cox = coxMap.get(memberId)!
        switch (dayOfWeek) {
          case 0: cox.availability.sunday = true; break
          case 1: cox.availability.monday = true; break
          case 2: cox.availability.tuesday = true; break
          case 3: cox.availability.wednesday = true; break
          case 4: cox.availability.thursday = true; break
          case 5: cox.availability.friday = true; break
          case 6: cox.availability.saturday = true; break
        }
      })
    })

    return Array.from(coxMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [availability, members, loading, error])

  return { coxes, loading, error }
}
