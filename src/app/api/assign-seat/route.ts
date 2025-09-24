// src/app/api/assign-seat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

export async function POST(req: NextRequest) {
  try {
    console.log('🪑 Starting seat assignment request...')

    // Validate environment variables
    if (!process.env.NOTION_TOKEN) {
      console.error('❌ NOTION_TOKEN is not set')
      return NextResponse.json(
        { error: 'Missing Notion token configuration', success: false },
        { status: 500 }
      )
    }

    const body = await req.json()
    const { outingId, seat, memberId } = body

    console.log('📥 Received seat assignment data:', {
      outingId,
      seat,
      memberId,
      bodyKeys: Object.keys(body)
    })

    // Validate required fields
    if (!outingId) {
      console.error('❌ Missing outingId')
      return NextResponse.json(
        { error: 'Missing outingId parameter', success: false },
        { status: 400 }
      )
    }

    if (!seat) {
      console.error('❌ Missing seat')
      return NextResponse.json(
        { error: 'Missing seat parameter', success: false },
        { status: 400 }
      )
    }

    // Validate seat format (should be a valid Notion property name)
    if (typeof seat !== 'string' || seat.trim() === '') {
      console.error('❌ Invalid seat format:', seat)
      return NextResponse.json(
        { error: 'Invalid seat format', success: false },
        { status: 400 }
      )
    }

    // Validate outingId format (should be a valid Notion page ID)
    if (typeof outingId !== 'string' || outingId.length < 32) {
      console.error('❌ Invalid outingId format:', outingId)
      return NextResponse.json(
        { error: 'Invalid outingId format', success: false },
        { status: 400 }
      )
    }

    // Validate memberId if provided
    if (memberId && (typeof memberId !== 'string' || memberId.length < 32)) {
      console.error('❌ Invalid memberId format:', memberId)
      return NextResponse.json(
        { error: 'Invalid memberId format', success: false },
        { status: 400 }
      )
    }

    // Map seat names to actual database field names
    const seatToFieldMapping: Record<string, string> = {
      'Coach/Bank Rider': 'Coach/Bank Rider' // This maps to the actual Notion property name
    }

    const actualSeatField = seatToFieldMapping[seat] || seat;

    const updatePayload = {
      [actualSeatField]: {
        relation: memberId ? [{ id: memberId }] : [],
      }
    }

    console.log('🔄 Updating Notion page with payload:', {
      pageId: outingId,
      properties: updatePayload
    })

    const response = await notion.pages.update({
      page_id: outingId,
      properties: updatePayload,
    })

    console.log('✅ Seat assignment successful:', {
      pageId: response.id,
      seat,
      memberId: memberId || 'cleared'
    })

    return NextResponse.json({
      success: true,
      data: {
        id: response.id,
        seat,
        memberId
      }
    })
  } catch (error) {
    console.error('❌ Error assigning seat:', error)

    // More detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : ''

    console.error('❌ Seat assignment error details:', {
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
          { error: 'Invalid seat property', details: errorMessage, success: false },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to assign seat',
        details: errorMessage,
        success: false
      },
      { status: 500 }
    )
  }
}