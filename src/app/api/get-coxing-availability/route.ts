// src/app/api/get-coxing-availability/route.ts
import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { CoxingAvailability } from '@/types/coxing'

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2025-09-03',
})

export async function GET(request: Request) {
  try {
    console.log('🔍 Fetching Coxing availability from Notion database...')

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

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

    // Build filter for date range if provided
    const filter: any = {}
    if (startDate && endDate) {
      filter.property = 'Date'
      filter.date = {
        on_or_after: startDate,
        on_or_before: endDate,
      }
    }

    // Query the data source with optional filter
    const response = await notion.request({
      method: 'post',
      path: `data_sources/${process.env.NOTION_COXING_DB_ID}/query`,
      body: {
        page_size: 100,
        ...(Object.keys(filter).length > 0 && { filter }),
      },
    }) as { results: unknown[] }

    console.log(`📊 Raw response: Found ${response.results.length} total results`)

    const results = response.results.filter(
      (r: unknown): r is PageObjectResponse => {
        const obj = r as Record<string, unknown>
        return 'properties' in obj
      }
    )

    console.log(`📋 Filtered results: ${results.length} valid pages`)

    // Helper function to safely extract property values
    const getPropertyValue = (page: PageObjectResponse, propertyName: string) => {
      const property = page.properties[propertyName]
      if (!property || typeof property !== 'object') return null

      return property
    }

    const availability: CoxingAvailability[] = results.map((page: PageObjectResponse) => {
      try {
        // Extract date from the Date property (assuming it's called "Date")
        const dateProperty = getPropertyValue(page, 'Date')
        let date = ''
        if (dateProperty && dateProperty.type === 'date' && dateProperty.date?.start) {
          date = dateProperty.date.start
        }

        // Extract relations for each time slot
        const extractMemberIds = (propertyName: string): string[] => {
          const property = getPropertyValue(page, propertyName)
          if (property && property.type === 'relation' && property.relation) {
            return property.relation.map((rel: { id: string }) => rel.id)
          }
          return []
        }

        const earlyAM = extractMemberIds('Early AM')
        const midAM = extractMemberIds('Mid AM')
        const midPM = extractMemberIds('Early PM') // Database has "Early PM" instead of "Mid PM"
        const latePM = extractMemberIds('Late PM')

        const availabilityItem: CoxingAvailability = {
          id: page.id,
          date,
          earlyAM,
          midAM,
          midPM,
          latePM,
        }

        console.log(`📅 Processed availability for ${availabilityItem.date}`)
        return availabilityItem
      } catch (error) {
        console.error('❌ Error processing availability item:', error, 'Page ID:', page.id)
        // Return a valid item even if there's an error
        return {
          id: page.id,
          date: 'Unknown Date',
          earlyAM: [],
          midAM: [],
          midPM: [],
          latePM: [],
        }
      }
    }).filter((item: CoxingAvailability) => item.date && item.date !== 'Unknown Date') // Filter out invalid items

    console.log(`✅ Successfully processed ${availability.length} availability items`)

    return NextResponse.json({
      availability,
      total: availability.length,
      success: true
    })
  } catch (error) {
    console.error('❌ Error fetching Coxing availability from Notion:', error)

    // More detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : ''

    console.error('❌ Error details:', {
      message: errorMessage,
      stack: errorStack,
      notionToken: process.env.NOTION_TOKEN ? 'Present' : 'Missing',
      databaseId: process.env.NOTION_COXING_DB_ID ? 'Present' : 'Missing'
    })

    return NextResponse.json(
      {
        error: 'Failed to fetch Coxing availability',
        details: errorMessage,
        success: false
      },
      { status: 500 }
    )
  }
}