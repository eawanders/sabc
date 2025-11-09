// src/app/api/get-event/[slug]/route.ts
import { NextResponse } from 'next/server'
import { queryDataSource } from '@/server/notion/query'
import { startTiming, createServerTiming } from '@/server/timing'
import { createSlug } from '@/lib/slug'

export const revalidate = 120

interface RouteContext {
  params: Promise<{
    slug: string
  }>
}

export async function GET(
  request: Request,
  context: RouteContext
) {
  const start = startTiming()
  const { slug } = await context.params

  try {
    const databaseId = resolveEventsDatabaseId()

    // Fetch all events
    const pages = await queryDataSource<any>(
      databaseId,
      {
        sorts: [
          {
            property: 'Date',
            direction: 'ascending',
          },
        ],
        page_size: 100,
      },
      'events.query'
    )

    // Transform pages and find matching event by slug
    const events = pages.map((page: any) => transformNotionPageToEvent(page))
    const matchingEvent = events.find((event: any) => {
      const eventSlug = createSlug(event.title)
      return eventSlug === slug
    })

    if (!matchingEvent) {
      const response = NextResponse.json(
        {
          success: false,
          error: 'Event not found'
        },
        { status: 404 }
      )
      response.headers.set('Server-Timing', createServerTiming(start))
      return response
    }

    const response = NextResponse.json({
      success: true,
      event: matchingEvent
    })
    response.headers.set('Server-Timing', createServerTiming(start))
    return response

  } catch (error) {
    console.error('❌ Error fetching event:', error)
    const response = NextResponse.json(
      {
        error: 'Failed to fetch event',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
    response.headers.set('Server-Timing', createServerTiming(start))
    return response
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

  // Extract embedded form from "Embedded Form" property (rich text type)
  // Notion rich text can be split across multiple segments, so we need to concatenate them
  let embeddedForm = ''
  const embeddedFormRichText = properties['Embedded Form']?.rich_text
  if (embeddedFormRichText && Array.isArray(embeddedFormRichText)) {
    embeddedForm = embeddedFormRichText
      .map((segment: any) => segment.text?.content || '')
      .join('')
  }

  // Debug: Log property names and embedded form data
  console.log('Available properties:', Object.keys(properties));
  console.log('Embedded Form property:', properties['Embedded Form']);
  console.log('Extracted embeddedForm:', embeddedForm);

  return {
    id: page.id,
    title,
    description,
    date,
    time: time || undefined,
    dateTime,
    imageUrl: imageUrl || undefined,
    embeddedForm: embeddedForm || undefined,
  }
}

function resolveEventsDatabaseId() {
  const explicit = process.env.NOTION_EVENTS_DB_ID
  if (explicit && explicit.trim().length > 0) {
    return explicit.trim()
  }
  return '27a80040-a8fa-804a-9f8b-d536dcc548a7'
}
