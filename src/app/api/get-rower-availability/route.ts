// src/app/api/get-rower-availability/route.ts
import { NextResponse } from 'next/server'
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { notionRequest } from '@/server/notion/client'
import { mapRowerAvailability } from '@/server/notion/rowerAvailability'
import { startTiming, createServerTiming } from '@/server/timing'
import { isNotionPageId } from '../_utils/schemas'

export const revalidate = 30

export async function GET(request: Request) {
  const start = startTiming()
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      const response = NextResponse.json(
        { error: 'memberId is required', success: false },
        { status: 400 }
      )
      response.headers.set('Server-Timing', createServerTiming(start))
      return response
    }

    if (!isNotionPageId(memberId)) {
      const response = NextResponse.json(
        { error: 'Invalid memberId', success: false },
        { status: 400 }
      )
      response.headers.set('Server-Timing', createServerTiming(start))
      return response
    }

    // Fetch the member page directly by ID
    const memberPage = await notionRequest<PageObjectResponse>(
      {
        method: 'get',
        path: `pages/${memberId}`
      },
      'rower-availability.get-member'
    )

    const availability = mapRowerAvailability(memberPage)

    const response = NextResponse.json({
      availability,
      success: true
    })
    response.headers.set('Server-Timing', createServerTiming(start))
    return response
  } catch (error) {
    console.error('❌ Error fetching rower availability from Notion:', error)

    const response = NextResponse.json(
      {
        error: 'Failed to fetch rower availability',
        success: false
      },
      { status: 500 }
    )
    response.headers.set('Server-Timing', createServerTiming(start))
    return response
  }
}
