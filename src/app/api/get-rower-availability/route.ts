// src/app/api/get-rower-availability/route.ts
import { NextResponse } from 'next/server'
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { RowerWeeklyAvailability, parseTimeRanges } from '@/types/rowerAvailability'
import { notionRequest } from '@/server/notion/client'
import { startTiming, createServerTiming } from '@/server/timing'

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    const response = NextResponse.json(
      {
        error: 'Failed to fetch rower availability',
        details: errorMessage,
        success: false
      },
      { status: 500 }
    )
    response.headers.set('Server-Timing', createServerTiming(start))
    return response
  }
}

function mapRowerAvailability(page: PageObjectResponse): RowerWeeklyAvailability {
  const properties = page.properties as Record<string, any>

  // Extract member name
  const fullName = extractText(properties['Full Name']) || 'Unknown'

  // Map day properties to availability
  const availability: RowerWeeklyAvailability = {
    memberId: page.id,
    memberName: fullName,
    monday: parseTimeRanges(extractText(properties['Unavailable Monday'])),
    tuesday: parseTimeRanges(extractText(properties['Unavailable Tuesday'])),
    wednesday: parseTimeRanges(extractText(properties['Unavailable Wednesday'])),
    thursday: parseTimeRanges(extractText(properties['Unavailable Thursday'])),
    friday: parseTimeRanges(extractText(properties['Unavailable Friday'])),
    saturday: parseTimeRanges(extractText(properties['Unavailable Saturday'])),
    sunday: parseTimeRanges(extractText(properties['Unavailable Sunday']))
  }

  return availability
}

function extractText(property: any): string | undefined {
  if (!property) return undefined

  if (Array.isArray(property.title)) {
    return property.title.map((item: { plain_text?: string }) => item.plain_text ?? '').join('').trim() || undefined
  }

  if (Array.isArray(property.rich_text)) {
    return property.rich_text.map((item: { plain_text?: string }) => item.plain_text ?? '').join('').trim() || undefined
  }

  if (typeof property === 'string') {
    return property.trim()
  }

  return undefined
}
