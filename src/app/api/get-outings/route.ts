// src/app/api/get-outings/route.ts
import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { Outing } from '@/types/outing'
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2025-09-03',
})

export async function GET() {
  try {
    console.log('🔍 Fetching outings from Notion database...')

    // Validate environment variables
    if (!process.env.NOTION_TOKEN) {
      console.error('❌ NOTION_TOKEN is not set')
      return NextResponse.json(
        { error: 'Missing Notion token configuration', success: false },
        { status: 500 }
      )
    }

    if (!process.env.NOTION_OUTINGS_DB_ID) {
      console.error('❌ NOTION_OUTINGS_DB_ID is not set')
      return NextResponse.json(
        { error: 'Missing Notion outings database ID configuration', success: false },
        { status: 500 }
      )
    }

    console.log('🗄️ Retrieving database:', process.env.NOTION_OUTINGS_DB_ID)

    // First get the database to find data sources
    const databaseResponse = await notion.request({
      method: 'get',
      path: `databases/${process.env.NOTION_OUTINGS_DB_ID}`,
    }) as { data_sources?: { id: string }[] }

    if (!databaseResponse.data_sources || databaseResponse.data_sources.length === 0) {
      console.error('❌ No data sources found for outings database')
      return NextResponse.json(
        { error: 'No data sources found for outings database', success: false },
        { status: 500 }
      )
    }

    const dataSourceId = databaseResponse.data_sources[0].id
    console.log(`📊 Using data source: ${dataSourceId}`)

    // Query the data source
    const response = await notion.request({
      method: 'post',
      path: `data_sources/${dataSourceId}/query`,
      body: {
        page_size: 100, // Increase page size for better performance
      },
    }) as { results: unknown[] }

    console.log('📊 Raw Notion response:', response.results.length, 'records')

    const results = response.results.filter(
      (r: unknown): r is PageObjectResponse => {
        const obj = r as Record<string, unknown>
        return 'properties' in obj
      }
    )

    console.log(`📋 Filtered results: ${results.length} valid pages`)

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

    const outings = results.map((page: PageObjectResponse) => ({
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

    console.log(`📤 Returning ${outings.length} outings`)
    console.log("📤 First outing summary:", outings[0] ? {
      id: outings[0].id,
      name: outings[0].properties?.Name,
      div: outings[0].properties?.Div?.select?.name,
      type: outings[0].properties?.Type?.select?.name
    } : "None")

    return NextResponse.json({ outings })
  } catch (error) {
    console.error('❌ Error fetching outings from Notion:', error)

    // More detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : ''

    console.error('❌ Error details:', {
      message: errorMessage,
      stack: errorStack,
      notionToken: process.env.NOTION_TOKEN ? 'Present' : 'Missing',
      databaseId: process.env.NOTION_OUTINGS_DB_ID ? 'Present' : 'Missing'
    })

    return NextResponse.json(
      { error: 'Failed to fetch outings' },
      { status: 500 }
    )
  }
}