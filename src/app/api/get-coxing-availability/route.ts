// src/app/api/get-coxing-availability/route.ts
import { NextResponse } from 'next/server'
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { CoxingAvailability } from '@/types/coxing'
import { getEnvVar } from '@/server/notion/env'
import { queryDataSource } from '@/server/notion/query'
import { startTiming, createServerTiming } from '@/server/timing'

export const revalidate = 30

export async function GET(request: Request) {
  const start = startTiming()
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const databaseId = getEnvVar('NOTION_COXING_DB_ID')
    const filter = buildDateFilter(startDate, endDate)

    const pages = await queryDataSource<PageObjectResponse>(
      databaseId,
      {
        filter,
      },
      'coxing.query'
    )

    const availability: CoxingAvailability[] = pages
      .map((page) => mapCoxingAvailability(page))
      .filter((item): item is CoxingAvailability => Boolean(item?.date))

    const response = NextResponse.json({
      availability,
      total: availability.length,
      success: true
    })
    response.headers.set('Server-Timing', createServerTiming(start))
    return response
  } catch (error) {
    console.error('❌ Error fetching Coxing availability from Notion:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    const response = NextResponse.json(
      {
        error: 'Failed to fetch Coxing availability',
        details: errorMessage,
        success: false
      },
      { status: 500 }
    )
    response.headers.set('Server-Timing', createServerTiming(start))
    return response
  }
}

function mapCoxingAvailability(page: PageObjectResponse): CoxingAvailability | null {
  const properties = page.properties as Record<string, any>;
  const date = properties['Date']?.date?.start;
  if (!date) {
    return null;
  }

  return {
    id: page.id,
    date,
    earlyAM: extractRelationIds(properties['Early AM']),
    midAM: extractRelationIds(properties['Mid AM']),
    midPM: extractRelationIds(properties['Early PM']),
    latePM: extractRelationIds(properties['Late PM']),
  };
}

function extractRelationIds(property: any): string[] {
  if (!property?.relation) return [];
  return property.relation.map((rel: { id: string }) => rel.id);
}

function buildDateFilter(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) {
    return undefined;
  }

  return {
    property: 'Date',
    date: {
      on_or_after: startDate,
      on_or_before: endDate,
    },
  };
}
