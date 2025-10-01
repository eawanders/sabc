// src/hooks/useFlagStatus.ts
import { useState, useEffect } from 'react'

interface FlagStatusData {
  status_text?: string
  notices?: string | string[]
  set_date?: string
}

interface UseFlagStatusResult {
  flagStatus: string | null
  loading: boolean
  error: string | null
}

export function useFlagStatus(): UseFlagStatusResult {
  const [flagStatus, setFlagStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchFlagStatus = async () => {
      setLoading(true)
      setError(null)

      try {
        console.log('🔄 Fetching flag status...')
        const response = await fetch('/api/flag-status', {
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error('Failed to fetch flag status')
        }

        const data: FlagStatusData = await response.json()
        console.log('📊 Fetched flag status:', data)

        setFlagStatus(data.status_text || null)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load flag status'
        console.error('❌ Error fetching flag status:', err)
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchFlagStatus()
  }, [])

  return { flagStatus, loading, error }
}
