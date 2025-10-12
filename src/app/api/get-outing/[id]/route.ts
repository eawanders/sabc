// src/app/api/get-outing/[id]/route.ts
import { NextResponse } from 'next/server'
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { notionRequest } from '@/server/notion/client'
import { startTiming, createServerTiming } from '@/server/timing'

export const revalidate = 15

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const start = startTiming()
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Outing ID is required' },
        { status: 400 }
      )
    }

    // Fetch the individual page from Notion
    const response = await notionRequest<PageObjectResponse>({
      method: 'get',
      path: `pages/${id}`,
    }, `pages/${id}`)

    // Type guard to ensure we have properties
    if (!response || !('properties' in response)) {
      return NextResponse.json(
        { error: 'Invalid page response' },
        { status: 404 }
      )
    }

    const page = response;

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
          // Return the relation array with relation IDs
          return {
            relation: typedProperty.relation as { id: string }[],
            has_more: typedProperty.has_more || false
          };
        case 'rich_text':
          const richText = typedProperty.rich_text as Array<{
            type: string;
            text?: { content: string };
            plain_text: string;
          }> | undefined;
          return {
            rich_text: richText || [],
            plain_text: richText?.map((rt) => rt.plain_text).join('') ?? ''
          };
        case 'title':
          const title = typedProperty.title as Array<{ plain_text: string }> | undefined;
          return {
            title: title || [],
            plain_text: title?.map((t) => t.plain_text).join('') ?? ''
          };
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

    // Map all properties with full detail
    const outing = {
      id: page.id,
      created_time: page.created_time,
      last_edited_time: page.last_edited_time,
      properties: {
        // Basic outing info
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
        SessionDetails: getPropertyValue(page.properties['Details']),

        // Crew positions with assignments and status
        Cox: getPropertyValue(page.properties['Cox']),
        CoxStatus: getPropertyValue(page.properties['Cox Status']),
        Stroke: getPropertyValue(page.properties['Stroke']),
        StrokeStatus: getPropertyValue(page.properties['Stroke Status']),
        Bow: getPropertyValue(page.properties['Bow']),
        BowStatus: getPropertyValue(page.properties['Bow Status']),

        // Numbered seats
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

        // Coach and substitutes
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
    };

    // Log sub properties for debugging
    console.log(`🔍 [get-outing] Sub properties from Notion for outing ${id}:`, {
      'Sub 1': page.properties['Sub 1'],
      'Sub 2': page.properties['Sub 2'],
      'Sub 3': page.properties['Sub 3'],
      'Sub 4': page.properties['Sub 4'],
    });
    console.log(`🔍 [get-outing] Mapped sub properties:`, {
      Sub1: outing.properties.Sub1,
      Sub2: outing.properties.Sub2,
      Sub3: outing.properties.Sub3,
      Sub4: outing.properties.Sub4,
    });

    const outingResponse = NextResponse.json({ outing })
    outingResponse.headers.set('Server-Timing', createServerTiming(start))
    return outingResponse
  } catch (error) {
    console.error('Error fetching outing details from Notion:', error)

    // Handle specific Notion API errors
    if (error && typeof error === 'object' && 'code' in error) {
      const notionError = error as { code: string; message: string };

      if (notionError.code === 'object_not_found') {
        return NextResponse.json(
          { error: 'Outing not found' },
          { status: 404 }
        )
      }

      if (notionError.code === 'unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized access to outing' },
          { status: 403 }
        )
      }
    }

    const errorResponse = NextResponse.json(
      { error: 'Failed to fetch outing details' },
      { status: 500 }
    )
    errorResponse.headers.set('Server-Timing', createServerTiming(start))
    return errorResponse
  }
}
