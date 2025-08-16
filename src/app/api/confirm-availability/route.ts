// src/app/api/confirm-availability/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

export async function POST(req: NextRequest) {
  try {
    console.log('🎯 Starting confirm availability request...')

    // Validate environment variables
    if (!process.env.NOTION_TOKEN) {
      console.error('❌ NOTION_TOKEN is not set')
      return NextResponse.json(
        { error: 'Missing Notion token configuration', success: false },
        { status: 500 }
      )
    }

    const body = await req.json()
    console.log('📥 Received confirm availability request:', body)

    const { outingId, seat, status } = body

    // Validate required fields
    if (!outingId) {
      console.error('❌ Missing outingId in request')
      return NextResponse.json(
        { error: 'Missing outingId parameter', success: false },
        { status: 400 }
      )
    }

    if (!seat) {
      console.error('❌ Missing seat in request')
      return NextResponse.json(
        { error: 'Missing seat parameter', success: false },
        { status: 400 }
      )
    }

    if (!status) {
      console.error('❌ Missing status in request')
      return NextResponse.json(
        { error: 'Missing status parameter', success: false },
        { status: 400 }
      )
    }

    // Validate outingId format
    if (typeof outingId !== 'string' || outingId.length < 32) {
      console.error('❌ Invalid outingId format:', outingId)
      return NextResponse.json(
        { error: 'Invalid outingId format', success: false },
        { status: 400 }
      )
    }

    // Validate status value
    const validStatuses = ['Available', 'Maybe', 'Maybe Available', 'Not Available', 'Awaiting Approval', 'Provisional', 'Confirmed', 'Cancelled']
    if (!validStatuses.includes(status)) {
      console.error('❌ Invalid status value:', status)
      return NextResponse.json(
        { error: `Invalid status value. Must be one of: ${validStatuses.join(', ')}`, success: false },
        { status: 400 }
      )
    }

    const statusField = `${seat} Status`
    console.log(`🔄 Confirming availability for ${seat} (${statusField}) to ${status}`)

    const updatePayload = {
      [statusField]: {
        status: { name: status }
      }
    }

    console.log('🔄 Updating Notion page with confirm payload:', {
      pageId: outingId,
      properties: updatePayload
    })

    const response = await notion.pages.update({
      page_id: outingId,
      properties: updatePayload
    })

    console.log(`✅ Confirm availability successful:`, {
      pageId: response.id,
      property: statusField,
      status: status
    })

    return NextResponse.json({
      success: true,
      data: {
        id: response.id,
        property: statusField,
        status: status
      }
    })
  } catch (error) {
    console.error('❌ Error confirming availability:', error)

    // More detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : ''

    console.error('❌ Confirm availability error details:', {
      message: errorMessage,
      stack: errorStack,
      notionToken: process.env.NOTION_TOKEN ? 'Present' : 'Missing'
    })

    // Check for specific Notion API errors
    if (error instanceof Error) {
      if (error.message.includes('Could not find page')) {
        return NextResponse.json(
          { error: 'Outing not found', details: errorMessage, success: false },
          { status: 404 }
        )
      }
      if (error.message.includes('Invalid page_id')) {
        return NextResponse.json(
          { error: 'Invalid outing ID', details: errorMessage, success: false },
          { status: 400 }
        )
      }
      if (error.message.includes('property does not exist')) {
        return NextResponse.json(
          { error: 'Invalid availability property', details: errorMessage, success: false },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to confirm availability', details: errorMessage, success: false },
      { status: 500 }
    )
  }
}