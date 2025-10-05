// src/app/api/get-tests/route.ts
import { NextResponse } from 'next/server'
import { getTests } from '@/server/notion/tests'
import { startTiming, createServerTiming } from '@/server/timing'

export const revalidate = 30

export async function GET() {
  const start = startTiming()
  try {
    const tests = await getTests()

    const response = NextResponse.json({
      tests,
      success: true,
      count: tests.length
    })
    response.headers.set('Server-Timing', createServerTiming(start))
    return response

  } catch (error) {
    console.error('❌ Error in get-tests API:', error)
    const response = NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false
      },
      { status: 500 }
    )
    response.headers.set('Server-Timing', createServerTiming(start))
    return response
  }
}
