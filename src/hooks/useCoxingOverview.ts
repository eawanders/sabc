// src/hooks/useCoxingOverview.ts
import { useState, useEffect } from 'react'
import { CoxingAvailability } from '@/types/coxing'
import { Member } from '@/types/members'
import { getWeekStart, getWeekEnd } from '@/lib/date'

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
  const [coxes, setCoxes] = useState<CoxOverview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCoxingData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Get current week date range
        const today = new Date()
        const weekStart = getWeekStart(today)
        const weekEnd = getWeekEnd(today)

        // Format dates for API
        const startDate = weekStart.toISOString().split('T')[0]
        const endDate = weekEnd.toISOString().split('T')[0]

        console.log('🔄 Fetching coxing availability for week:', startDate, 'to', endDate)

        // Fetch both coxing availability and members in parallel
        const [availabilityResponse, membersResponse] = await Promise.all([
          fetch(`/api/get-coxing-availability?startDate=${startDate}&endDate=${endDate}`),
          fetch('/api/get-members')
        ])

        if (!availabilityResponse.ok || !membersResponse.ok) {
          throw new Error('Failed to fetch data')
        }

        const availabilityData = await availabilityResponse.json()
        const membersData = await membersResponse.json()

        if (!availabilityData.success || !membersData.success) {
          throw new Error('API returned error')
        }

        const availability: CoxingAvailability[] = availabilityData.availability || []
        const members: Member[] = membersData.members || []

        console.log('📊 Fetched availability:', availability.length, 'days')
        console.log('👥 Fetched members:', members.length)

        // Process the data to create cox overview
        const coxMap = new Map<string, CoxOverview>()

        // Initialize availability tracking for each day
        availability.forEach((day) => {
          const date = new Date(day.date)
          const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, etc.

          // Combine all time slots for the day
          const allMemberIds = new Set([
            ...day.earlyAM,
            ...day.midAM,
            ...day.midPM,
            ...day.latePM,
          ])

          // For each member available on this day
          allMemberIds.forEach((memberId) => {
            if (!coxMap.has(memberId)) {
              // Find member details
              const member = members.find((m) => m.id === memberId)
              if (!member) return

              // Create initials from name
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

            // Mark this day as available
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

        // Convert map to array and sort by name
        const coxArray = Array.from(coxMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name)
        )

        console.log('✅ Processed coxing overview:', coxArray.length, 'coxes')
        setCoxes(coxArray)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load coxing data'
        console.error('❌ Error fetching coxing overview:', err)
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchCoxingData()
  }, [])

  return { coxes, loading, error }
}
