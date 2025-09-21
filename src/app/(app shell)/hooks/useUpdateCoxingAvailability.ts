// src/app/(app shell)/hooks/useUpdateCoxingAvailability.ts

import { useState } from 'react'
import { CoxingUpdateRequest, CoxingUpdateResponse } from '@/types/coxing'

/**
 * Hook for updating Coxing availability
 */
export function useUpdateCoxingAvailability() {
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateAvailability = async (request: CoxingUpdateRequest): Promise<CoxingUpdateResponse | null> => {
    try {
      setUpdating(true)
      setError(null)

      const response = await fetch('/api/update-coxing-availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      const data: CoxingUpdateResponse = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to update Coxing availability')
      }

      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error updating Coxing availability:', err)
      return null
    } finally {
      setUpdating(false)
    }
  }

  return {
    updateAvailability,
    updating,
    error,
  }
}