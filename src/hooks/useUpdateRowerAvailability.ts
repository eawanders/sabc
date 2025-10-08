// src/hooks/useUpdateRowerAvailability.ts
import { useState, useCallback } from 'react'
import {
  UpdateRowerAvailabilityRequest,
  UpdateRowerAvailabilityResponse
} from '@/types/rowerAvailability'

interface UseUpdateRowerAvailabilityResult {
  updateAvailability: (request: UpdateRowerAvailabilityRequest) => Promise<UpdateRowerAvailabilityResponse>
  updating: boolean
  error: string | null
}

/**
 * Hook for updating rower availability
 */
export function useUpdateRowerAvailability(): UseUpdateRowerAvailabilityResult {
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateAvailability = useCallback(async (
    request: UpdateRowerAvailabilityRequest
  ): Promise<UpdateRowerAvailabilityResponse> => {
    setUpdating(true)
    setError(null)

    try {
      const response = await fetch('/api/update-rower-availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      })

      const data: UpdateRowerAvailabilityResponse = await response.json()

      if (!response.ok || !data.success) {
        const errorMsg = (data as any).details || (data as any).error || 'Failed to update availability'
        setError(errorMsg)
        throw new Error(errorMsg)
      }

      return data
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMsg)
      throw err
    } finally {
      setUpdating(false)
    }
  }, [])

  return { updateAvailability, updating, error }
}
