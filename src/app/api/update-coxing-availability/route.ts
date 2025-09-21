// src/app/api/update-coxing-availability/route.ts
import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { CoxingUpdateRequest, CoxingUpdateResponse } from '@/types/coxing'

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2025-09-03',
})

export async function POST(request: Request) {
  try {
    console.log('🔄 Updating Coxing availability...')

    const body: CoxingUpdateRequest = await request.json()
    const { memberId, date, timeSlot, action } = body

    // Validate input
    if (!memberId || !date || !timeSlot || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: memberId, date, timeSlot, action' },
        { status: 400 }
      )
    }

    if (!['earlyAM', 'midAM', 'midPM', 'latePM'].includes(timeSlot)) {
      return NextResponse.json(
        { error: 'Invalid timeSlot. Must be one of: earlyAM, midAM, midPM, latePM' },
        { status: 400 }
      )
    }

    if (!['add', 'remove'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be either "add" or "remove"' },
        { status: 400 }
      )
    }

    // Validate environment variables
    if (!process.env.NOTION_TOKEN) {
      console.error('❌ NOTION_TOKEN is not set')
      return NextResponse.json(
        { error: 'Missing Notion token configuration' },
        { status: 500 }
      )
    }

    if (!process.env.NOTION_COXING_DB_ID) {
      console.error('❌ NOTION_COXING_DB_ID is not set')
      return NextResponse.json(
        { error: 'Missing Notion Coxing database ID configuration' },
        { status: 500 }
      )
    }

    console.log(`🗄️ Using data source: ${process.env.NOTION_COXING_DB_ID}`)

    // Map timeSlot to property name
    const propertyNameMap = {
      earlyAM: 'Early AM',
      midAM: 'Mid AM',
      midPM: 'Early PM', // Database has "Early PM" instead of "Mid PM"
      latePM: 'Late PM',
    }
    const propertyName = propertyNameMap[timeSlot]

    // Query the database for the pageId
    const queryResponse = await notion.request({
      method: 'post',
      path: `data_sources/${process.env.NOTION_COXING_DB_ID}/query`,
      body: {
        filter: {
          property: 'Date',
          date: {
            equals: date,
          },
        },
      },
    }) as { results: { id: string }[] }

    let pageId: string

    if (queryResponse.results.length > 0) {
      pageId = queryResponse.results[0].id
      console.log(`📝 Found existing page: ${pageId}`)
    } else {
      // Create new page if not found
      console.log(`📄 Creating new page for date: ${date}`)

      // Corrected syntax for TypeScript type assertion
      const createResponse = (await notion.request({
        method: 'post',
        path: 'pages',
        body: {
          parent: {
            type: 'data_source_id',
            data_source_id: process.env.NOTION_COXING_DB_ID,
          },
          properties: {
            'Date': {
              type: 'date',
              date: {
                start: date,
              },
            },
            [propertyName]: {
              type: 'relation',
              relation: [{ id: memberId }],
            },
          },
        },
      })) as { id: string };

      pageId = createResponse.id;
      console.log(`✅ Created new page: ${pageId}`)
    }

    // For existing page, we need to get current relations and update them
    const pageResponse = await notion.request({
      method: 'get',
      path: `pages/${pageId}`,
    }) as { properties: Record<string, { relation?: { id: string }[] }> }

    const currentRelations = pageResponse.properties[propertyName]?.relation || []
    // Optimize relation updates to avoid fetching all relations
    const updatedRelations =
      action === 'add'
        ? [...new Set([...currentRelations, { id: memberId }])]
        : currentRelations.filter((rel) => rel.id !== memberId)

    // Update the page directly
    await notion.request({
      method: 'patch',
      path: `pages/${pageId}`,
      body: {
        properties: {
          [propertyName]: {
            type: 'relation',
            relation: updatedRelations,
          },
        },
      },
    })

    console.log(`✅ Successfully updated availability for ${timeSlot} on ${date}`)

    const response: CoxingUpdateResponse = {
      success: true,
      message: `Successfully ${action === 'add' ? 'added' : 'removed'} availability for ${timeSlot} on ${date}`,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('❌ Error updating Coxing availability:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        error: 'Failed to update Coxing availability',
        details: errorMessage,
        success: false
      },
      { status: 500 }
    )
  }
}