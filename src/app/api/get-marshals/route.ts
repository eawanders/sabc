// src/app/api/get-marshals/route.ts
import { NextResponse } from 'next/server';
import { getMarshals } from '@/server/notion/marshals';
import { startTiming, createServerTiming } from '@/server/timing';

export const revalidate = 30;

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
