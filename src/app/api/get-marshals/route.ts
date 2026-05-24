// src/app/api/get-marshals/route.ts
import { NextResponse } from 'next/server';
import { getMarshals } from '@/server/notion/marshals';
import { startTiming, createServerTiming } from '@/server/timing';

// Always read Notion fresh — the page is signup-driven and stale data
// (e.g. after assign/clear or an edit made directly in Notion) confuses
// captains who expect the table to reflect reality immediately.
export const dynamic = 'force-dynamic';

export async function GET() {
  const start = startTiming();
  try {
    const slots = await getMarshals();
    const published = slots.filter((s) => s.publish);
    const response = NextResponse.json({
      slots: published,
      success: true,
      count: published.length,
    });
    response.headers.set('Server-Timing', createServerTiming(start));
    return response;
  } catch (error) {
    console.error('❌ Error in get-marshals API:', error);
    const response = NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false,
      },
      { status: 500 }
    );
    response.headers.set('Server-Timing', createServerTiming(start));
    return response;
  }
}
