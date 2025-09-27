// src/hooks/useEvents.ts
'use client'

import { useState, useEffect } from 'react'
import type { Event } from '@/components/EventCard'

interface UseEventsResult {
  events: Event[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useEvents(): UseEventsResult {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/get-events')

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        setEvents(data.events || [])
      } else {
        throw new Error(data.error || 'Failed to fetch events')
      }
    } catch (err) {
      console.error('Error fetching events:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch events')
    } finally {
      setLoading(false)
    }
  }

  const refetch = () => {
    fetchEvents()
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  return { events, loading, error, refetch }
}