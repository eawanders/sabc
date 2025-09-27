// src/app/api/get-events/route.ts
import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2025-09-03',
})

const EVENTS_DB_ID = '27a80040-a8fa-804a-9f8b-d536dcc548a7'

export async function GET() {
  try {
    console.log('🔍 Fetching events from Notion...')

    // Validate environment variables
    if (!process.env.NOTION_TOKEN) {
      console.error('❌ NOTION_TOKEN is not set')
      return NextResponse.json(
        { error: 'Missing Notion token configuration' },
        { status: 500 }
      )
    }

    console.log(`🗄️ Using Events database: ${EVENTS_DB_ID}`)

    // First get the database to find data sources
    const databaseResponse = await notion.request({
      method: 'get',
      path: `databases/${EVENTS_DB_ID}`,
    }) as { data_sources?: { id: string }[] }

    if (!databaseResponse.data_sources || databaseResponse.data_sources.length === 0) {
      console.error('❌ No data sources found for events database')
      return NextResponse.json(
        { error: 'No data sources found for events database' },
        { status: 500 }
      )
    }

    const dataSourceId = databaseResponse.data_sources[0].id
    console.log(`📊 Using data source: ${dataSourceId}`)

    // Query the Events database
    const queryResponse = await notion.request({
      method: 'post',
      path: `data_sources/${dataSourceId}/query`,
      body: {
        sorts: [
          {
            property: 'Date',
            direction: 'ascending'
          }
        ],
        page_size: 50, // Limit to 50 events for performance
      },
    }) as any

    console.log(`✅ Retrieved ${queryResponse.results?.length || 0} events`)

    // Transform the Notion results to our Event format
    const events = queryResponse.results?.map((page: any) => transformNotionPageToEvent(page)) || []

    return NextResponse.json({
      success: true,
      events,
      count: events.length
    })

  } catch (error) {
    console.error('❌ Error fetching events:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch events',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

function transformNotionPageToEvent(page: any): any {
  const properties = page.properties || {}

  // Extract title from "Event" property (title type)
  const title = properties.Event?.title?.[0]?.text?.content || 'Untitled Event'

  // Extract description from "Description" property (text type)
  const description = properties.Description?.rich_text?.[0]?.text?.content || ''

  // Extract date from "Date" property (date type)
  let date = ''
  let time = ''
  let dateTime = ''

  if (properties.Date?.date) {
    const notionDate = properties.Date.date
    dateTime = notionDate.start

    // Format date for display
    const dateObj = new Date(notionDate.start)
    date = dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    // Check if time is included
    if (notionDate.start.includes('T')) {
      const startObj = dateObj
      const startTime = startObj.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })

      if (notionDate.end) {
        const endObj = new Date(notionDate.end)
        const endTime = endObj.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })

        // Show both start and end times
        time = `${startTime} — ${endTime}`
      } else {
        time = startTime
      }
    }
  }

  // Extract image from "Files & media" property (file type)
  let imageUrl = ''
  const filesMedia = properties['Files & media']?.files
  if (filesMedia && filesMedia.length > 0) {
    const firstFile = filesMedia[0]
    if (firstFile.type === 'file') {
      imageUrl = firstFile.file?.url || ''
    } else if (firstFile.type === 'external') {
      imageUrl = firstFile.external?.url || ''
    }
  }

  return {
    id: page.id,
    title,
    description,
    date,
    time: time || undefined,
    dateTime,
    imageUrl: imageUrl || undefined,
  }
}