// src/hooks/useUpcomingSessions.ts
import { useState, useEffect } from 'react'
import { CalendarEvent } from '@/types/calendar'
import { Outing } from '@/types/outing'
import { mapOutingsToEvents } from '@/app/(app shell)/mappers/mapOutingsToEvents'

interface UseUpcomingSessionsResult {
  sessions: CalendarEvent[]
  loading: boolean
  error: string | null
}

export function useUpcomingSessions(limit: number = 3): UseUpcomingSessionsResult {
  const [sessions, setSessions] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchUpcomingSessions = async () => {
      setLoading(true)
      setError(null)

      try {
        console.log('🔄 Fetching upcoming sessions...')
        const response = await fetch('/api/get-outings')

        if (!response.ok) {
          throw new Error('Failed to fetch outings')
        }

        const data = await response.json()
        const outings: Outing[] = data.outings || []

        console.log('📊 Fetched outings:', outings.length)

        // Map outings to calendar events
        const allEvents = mapOutingsToEvents(outings)

        // Get current date/time
        const now = new Date()

        // Filter for sessions that are happening now or in the future
        // Do NOT filter out cancelled sessions
        const upcomingSessions = allEvents
          .filter(event => event.endTime >= now) // Include sessions happening now or later
          .sort((a, b) => a.startTime.getTime() - b.startTime.getTime()) // Sort by start time ascending
          .slice(0, limit) // Take only the first N sessions

        console.log('✅ Upcoming sessions:', upcomingSessions.length)
        setSessions(upcomingSessions)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load upcoming sessions'
        console.error('❌ Error fetching upcoming sessions:', err)
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchUpcomingSessions()
  }, [limit])

  return { sessions, loading, error }
}
