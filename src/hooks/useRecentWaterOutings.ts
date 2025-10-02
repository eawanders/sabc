// src/hooks/useRecentWaterOutings.ts
import { useState, useEffect } from 'react'
import { CalendarEvent } from '@/types/calendar'
import { Outing } from '@/types/outing'
import { mapOutingsToEvents } from '@/app/(app shell)/mappers/mapOutingsToEvents'

interface UseRecentWaterOutingsResult {
  outings: CalendarEvent[]
  loading: boolean
  error: string | null
}

export function useRecentWaterOutings(limit: number = 3): UseRecentWaterOutingsResult {
  const [outings, setOutings] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRecentWaterOutings = async () => {
      setLoading(true)
      setError(null)

      try {
        console.log('🔄 Fetching recent water outings...')
        const response = await fetch('/api/get-outings')

        if (!response.ok) {
          throw new Error('Failed to fetch outings')
        }

        const data = await response.json()
        const allOutings: Outing[] = data.outings || []

        console.log('📊 Fetched outings:', allOutings.length)

        // Map outings to calendar events
        const allEvents = mapOutingsToEvents(allOutings)

        // Get current date/time
        const now = new Date()

        // Normalize status function
        const normalizeStatus = (status: string): string => {
          const lower = status.toLowerCase()
          if (lower.includes('confirm')) return 'Confirmed'
          if (lower.includes('cancel')) return 'Cancelled'
          return 'Provisional'
        }

        // Filter for:
        // 1. Water outings only
        // 2. Past outings (endTime < now)
        // 3. Confirmed status only
        const recentWaterOutings = allEvents
          .filter(event => {
            const isWater = event.type === 'Water'
            const isPast = event.endTime < now
            const isConfirmed = normalizeStatus(event.status) === 'Confirmed'

            return isWater && isPast && isConfirmed
          })
          .sort((a, b) => b.endTime.getTime() - a.endTime.getTime()) // Sort by endTime descending (most recent first)
          .slice(0, limit) // Take only the first N outings

        console.log('✅ Recent water outings:', recentWaterOutings.length)
        setOutings(recentWaterOutings)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load recent water outings'
        console.error('❌ Error fetching recent water outings:', err)
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchRecentWaterOutings()
  }, [limit])

  return { outings, loading, error }
}
