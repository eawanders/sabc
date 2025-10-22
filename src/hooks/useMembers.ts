// src/hooks/useMembers.ts
import { useState, useEffect, useCallback } from 'react'
import { Member } from '@/types/members'

const CACHE_TTL_MS = 60_000
let cachedMembers: Member[] | null = null
let cacheTimestamp = 0
let inflightPromise: Promise<Member[]> | null = null

async function loadMembers(force = false): Promise<Member[]> {
  if (!force && cachedMembers && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedMembers
  }

  if (inflightPromise) {
    return inflightPromise
  }

  inflightPromise = fetch('/api/get-members', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })
    .then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch members: ${response.status} ${response.statusText} ${errorText}`)
      }
      return response.json()
    })
    .then((data: ApiResponse) => {
      if (!data.members || !Array.isArray(data.members)) {
        throw new Error('Invalid response format: members array not found')
      }
      cachedMembers = data.members
      cacheTimestamp = Date.now()
      return cachedMembers
    })
    .finally(() => {
      inflightPromise = null
    })

  return inflightPromise
}

interface UseMembersResult {
  members: Member[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

interface ApiResponse {
  members: Member[]
  total?: number
  success?: boolean
  error?: string
  details?: string
}

export function useMembers(): UseMembersResult {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await loadMembers()
      setMembers(data)
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      console.error('useMembers: error fetching members', err)
      setError(errorMessage)
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  return {
    members,
    loading,
    error,
    refresh: async () => {
      cachedMembers = null
      cacheTimestamp = 0
      await fetchMembers()
    },
  }
}