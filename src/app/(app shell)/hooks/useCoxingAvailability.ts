// src/app/(app shell)/hooks/useCoxingAvailability.ts

import { useState, useEffect } from 'react'
import { CoxingAvailability } from '@/types/coxing'

/**
 * Hook for fetching and managing Coxing availability data
 */
export function useCoxingAvailability() {
  const [availability, setAvailability] = useState<CoxingAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch availability data
  useEffect(() => {
    async function fetchAvailability() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/get-coxing-availability')
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch Coxing availability')
        }

        setAvailability(data.availability || [])
      } catch (err) {
        console.error('Error fetching Coxing availability:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchAvailability()
  }, [])

  const refetch = () => {
    async function fetchAvailability() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/get-coxing-availability')
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch Coxing availability')
        }

        setAvailability(data.availability || [])
      } catch (err) {
        console.error('Error fetching Coxing availability:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchAvailability()
  }

  return {
    availability,
    loading,
    error,
    refetch,
  }
}