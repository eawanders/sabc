// src/app/api/get-outings/route.ts
import { NextResponse } from 'next/server'
import { Outing } from '@/types/outing'
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { getEnvVar } from '@/server/notion/env'
import { queryDataSource } from '@/server/notion/query'
import { startTiming, createServerTiming } from '@/server/timing'

export const revalidate = 30

export async function GET() {
  const start = startTiming()
  try {
    const databaseId = getEnvVar('NOTION_OUTINGS_DB_ID')
    const results = await queryDataSource<PageObjectResponse>(
      databaseId,
      {
      },
      'outings.query'
    )

    const getPropertyValue = (property: unknown) => {
      if (!property || typeof property !== 'object' || property === null) return undefined;

      const typedProperty = property as { type: string; [key: string]: unknown };

      switch (typedProperty.type) {
        case 'number':
          return { number: typedProperty.number };
        case 'url':
          return { url: typedProperty.url };
        case 'select':
          return { select: typedProperty.select };
        case 'multi_select':
          return { multi_select: typedProperty.multi_select };
        case 'relation':
          // Return the relation array directly for frontend compatibility
          return typedProperty.relation;
        case 'rich_text':
          const richText = typedProperty.rich_text as Array<{ plain_text: string }> | undefined;
          return richText?.map((rt) => rt.plain_text).join('') ?? '';
        case 'title':
          const title = typedProperty.title as Array<{ plain_text: string }> | undefined;
          return title?.map((t) => t.plain_text).join('') ?? '';
        case 'date':
          return { date: typedProperty.date };
        case 'checkbox':
          return { checkbox: typedProperty.checkbox };
        case 'status':
          return { status: typedProperty.status };
        case 'people':
          return { people: typedProperty.people };
        case 'unique_id':
          return { unique_id: typedProperty.unique_id };
        default:
          return typedProperty[typedProperty.type];
      }
    };

    const outings = results
      .filter((page): page is PageObjectResponse => Boolean(page && 'properties' in page))
      .map((page: PageObjectResponse) => ({
      id: page.id,
      properties: {
        Term: getPropertyValue(page.properties['Term']),
        Week: getPropertyValue(page.properties['Week']),
        OutingID: getPropertyValue(page.properties['Outing ID']),
        Name: getPropertyValue(page.properties['Name']),
        Div: getPropertyValue(page.properties['Div']),
        Type: getPropertyValue(page.properties['Type']),
        Shell: getPropertyValue(page.properties['Shell']),
        StartDateTime: getPropertyValue(page.properties['Start Date/Time']),
        EndDateTime: getPropertyValue(page.properties['End Date/Time']),
        PublishOuting: getPropertyValue(page.properties['Publish Outing']),
        OutingStatus: getPropertyValue(page.properties['Status']),
        SessionDetails: getPropertyValue(page.properties['Session Details']),
        Cox: getPropertyValue(page.properties['Cox']),
        CoxStatus: getPropertyValue(page.properties['Cox Status']),
        Stroke: getPropertyValue(page.properties['Stroke']),
        StrokeStatus: getPropertyValue(page.properties['Stroke Status']),
        Bow: getPropertyValue(page.properties['Bow']),
        BowStatus: getPropertyValue(page.properties['Bow Status']),
        '2 Seat': getPropertyValue(page.properties['2 Seat']),
        '2 Seat Status': getPropertyValue(page.properties['2 Seat Status']),
        '3 Seat': getPropertyValue(page.properties['3 Seat']),
        '3 Seat Status': getPropertyValue(page.properties['3 Seat Status']),
        '4 Seat': getPropertyValue(page.properties['4 Seat']),
        '4 Seat Status': getPropertyValue(page.properties['4 Seat Status']),
        '5 Seat': getPropertyValue(page.properties['5 Seat']),
        '5 Seat Status': getPropertyValue(page.properties['5 Seat Status']),
        '6 Seat': getPropertyValue(page.properties['6 Seat']),
        '6 Seat Status': getPropertyValue(page.properties['6 Seat Status']),
        '7 Seat': getPropertyValue(page.properties['7 Seat']),
        '7 Seat Status': getPropertyValue(page.properties['7 Seat Status']),
        CoachBankRider: getPropertyValue(page.properties['Coach/Bank Rider']),
        BankRiderStatus: getPropertyValue(page.properties['Bank Rider Status']),
        Sub1: getPropertyValue(page.properties['Sub 1']),
        Sub1Status: getPropertyValue(page.properties['Sub 1 Status']),
        Sub2: getPropertyValue(page.properties['Sub 2']),
        Sub2Status: getPropertyValue(page.properties['Sub 2 Status']),
        Sub3: getPropertyValue(page.properties['Sub 3']),
        Sub3Status: getPropertyValue(page.properties['Sub 3 Status']),
        Sub4: getPropertyValue(page.properties['Sub 4']),
        Sub4Status: getPropertyValue(page.properties['Sub 4 Status']),
      },
    })) as Outing[]

    const response = NextResponse.json({ outings })
    response.headers.set('Server-Timing', createServerTiming(start))
    return response
  } catch (error) {
    console.error('❌ Error fetching outings from Notion:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    const response = NextResponse.json(
      { error: 'Failed to fetch outings', details: errorMessage },
      { status: 500 }
    )
    response.headers.set('Server-Timing', createServerTiming(start))
    return response
  }
}
