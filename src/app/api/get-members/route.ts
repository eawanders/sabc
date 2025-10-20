// src/app/api/get-members/route.ts
import { NextResponse } from 'next/server'
import { getMembers } from '@/server/notion/members'
import { startTiming, createServerTiming } from '@/server/timing'

export const dynamic = 'force-dynamic'
export const revalidate = 60

export async function GET(request: Request) {
  const start = startTiming()
  try {
    const url = new URL(request.url)
    const idsParam = url.searchParams.get('ids')
    const filterIds = idsParam
      ? idsParam
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : []

    const members = await getMembers()
    const payload = filterIds.length
      ? members.filter((member) => filterIds.includes(member.id))
      : members

    const response = NextResponse.json({
      members: payload,
      total: payload.length,
      success: true,
    })
    response.headers.set('Server-Timing', createServerTiming(start))
    return response
  } catch (error) {
    console.error('❌ Error fetching members from Notion:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    const response = NextResponse.json(
      {
        error: 'Failed to fetch members',
        details: message,
        success: false,
      },
      { status: 500 }
    )
    response.headers.set('Server-Timing', createServerTiming(start))
    return response
  }
}
