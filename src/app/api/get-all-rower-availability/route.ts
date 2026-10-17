// src/app/api/get-all-rower-availability/route.ts
import { NextResponse } from 'next/server'
import { getAllRowerAvailability } from '@/server/notion/rowerAvailability'
import { startTiming, createServerTiming } from '@/server/timing'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start = startTiming()
  try {
    const availability = await getAllRowerAvailability()

    const response = NextResponse.json({
      availability,
      total: availability.length,
      success: true
    })
    response.headers.set('Server-Timing', createServerTiming(start))
    return response
  } catch (error) {
    console.error('❌ Error fetching all rower availability from Notion:', error)
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
