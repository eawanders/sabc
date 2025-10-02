// src/hooks/useNextEvent.ts
import { useState, useEffect } from 'react'
import type { Event } from '@/components/EventCard'

interface UseNextEventResult {
  event: Event | null
  loading: boolean
  error: string | null
}

export function useNextEvent(): UseNextEventResult {
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchNextEvent = async () => {
      setLoading(true)
      setError(null)

      try {
        console.log('🔄 Fetching next event...')
        const response = await fetch('/api/get-events')

        if (!response.ok) {
          throw new Error('Failed to fetch events')
        }

        const data = await response.json()

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch events')
        }

        const events: Event[] = data.events || []
        console.log('📊 Fetched events:', events.length)

        // Get current date/time
        const now = new Date()

        // Filter for future events and sort by date
        const upcomingEvents = events
          .filter(evt => {
            if (!evt.dateTime) return false
            const eventDate = new Date(evt.dateTime)
            return eventDate >= now
          })
          .sort((a, b) => {
            const dateA = new Date(a.dateTime!)
            const dateB = new Date(b.dateTime!)
            return dateA.getTime() - dateB.getTime()
          })

        // Get the next event (first in sorted array)
        const nextEvent = upcomingEvents.length > 0 ? upcomingEvents[0] : null

        console.log('✅ Next event:', nextEvent?.title || 'None')
        setEvent(nextEvent)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load next event'
        console.error('❌ Error fetching next event:', err)
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchNextEvent()
  }, [])

  return { event, loading, error }
}
