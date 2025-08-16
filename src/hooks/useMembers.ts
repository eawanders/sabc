// src/hooks/useMembers.ts
import { useState, useEffect, useCallback } from 'react'
import { Member } from '@/types/members'

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
    console.log('🔄 useMembers: Starting to fetch members...')
    setLoading(true)
    setError(null)

    try {
      console.log('🌐 useMembers: Making API request to /api/get-members')
      const response = await fetch('/api/get-members', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      console.log(`📡 useMembers: Response status: ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ useMembers: API request failed with status ${response.status}:`, errorText)
        throw new Error(`Failed to fetch members: ${response.status} ${response.statusText}`)
      }

      const data: ApiResponse = await response.json()
      console.log('📥 useMembers: Raw API response:', data)

      if (!data.success && data.error) {
        console.error('❌ useMembers: API returned error:', data.error, data.details)
        throw new Error(data.error + (data.details ? `: ${data.details}` : ''))
      }

      if (!data.members || !Array.isArray(data.members)) {
        console.error('❌ useMembers: Invalid response format - members not found or not array:', data)
        throw new Error('Invalid response format: members array not found')
      }

      console.log(`✅ useMembers: Successfully fetched ${data.members.length} members`)
      console.log('👥 useMembers: Members:', data.members.map(m => `${m.name} (${m.id})`))

      setMembers(data.members)
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      console.error('❌ useMembers: Error fetching members:', err)
      setError(errorMessage)
      setMembers([]) // Reset members on error
    } finally {
      setLoading(false)
      console.log('🏁 useMembers: Fetch complete')
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    console.log('🚀 useMembers: Hook initialized, triggering initial fetch')
    fetchMembers()
  }, [fetchMembers])

  // Debug logging for state changes
  useEffect(() => {
    console.log('📊 useMembers: State update -', {
      membersCount: members.length,
      loading,
      error,
      firstMember: members[0]?.name || 'None'
    })
  }, [members, loading, error])

  return {
    members,
    loading,
    error,
    refresh: fetchMembers,
  }
}
