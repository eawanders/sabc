// src/app/api/assign-seat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { SEAT_PROPERTIES, isSeatStatus } from '@/lib/seatProperties'

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
    const { outingId, seat, memberId, status } = body

    const isSub = seat && typeof seat === 'string' && seat.startsWith('Sub');

    console.log(`📥 Received seat assignment data ${isSub ? '(SUB SEAT)' : '(regular seat)'}:`, {
      outingId,
      seat,
      memberId,
      isSub,
      bodyKeys: Object.keys(body),
      fullBody: body
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

    // Validate status if provided: it is written to the seat's status property in the same update
    const statusProperty = typeof seat === 'string' ? SEAT_PROPERTIES[seat]?.status : undefined
    if (status !== undefined && (!isSeatStatus(status) || !statusProperty)) {
      console.error('❌ Invalid status for seat:', { seat, status })
      return NextResponse.json(
        { error: 'Invalid status', success: false },
        { status: 400 }
      )
    }

    // Map seat names to actual database field names
    const seatToFieldMapping: Record<string, string> = {
      'Coach/Bank Rider': 'Coach/Bank Rider', // This maps to the actual Notion property name
      'Sub1': 'Sub 1', // Map Sub1 to "Sub 1" (with space)
      'Sub2': 'Sub 2', // Map Sub2 to "Sub 2" (with space)
      'Sub3': 'Sub 3', // Map Sub3 to "Sub 3" (with space)
      'Sub4': 'Sub 4'  // Map Sub4 to "Sub 4" (with space)
    }

    const actualSeatField = seatToFieldMapping[seat] || seat;

    if (isSub) {
      console.log(`🔍 Processing SUB seat assignment:`, {
        originalSeat: seat,
        actualSeatField,
        isMapped: seat !== actualSeatField,
        memberId: memberId || 'clearing'
      });
    }

    const updatePayload = {
      [actualSeatField]: {
        relation: memberId ? [{ id: memberId }] : [],
      },
      // Member and status go in one update so a seat is never left with one half written
      ...(status !== undefined && statusProperty ? { [statusProperty]: { status: { name: status } } } : {}),
    }

    console.log(`🔄 Updating Notion page ${isSub ? '(SUB SEAT)' : ''}with payload:`, {
      pageId: outingId,
      properties: updatePayload,
      isSub,
      seat,
      actualSeatField
    })

    console.log(`📝 [assign-seat] About to call Notion API:`, {
      page_id: outingId,
      properties: JSON.stringify(updatePayload, null, 2),
      seatField: actualSeatField,
      relationValue: memberId ? [{ id: memberId }] : [],
      isSub
    });

    let response;
    try {
      response = await notion.pages.update({
        page_id: outingId,
        properties: updatePayload,
      })
      console.log(`✅ [assign-seat] Notion API call succeeded for ${actualSeatField}`);
    } catch (notionError) {
      console.error(`❌ [assign-seat] Notion API call failed for ${actualSeatField}:`, notionError);
      console.error(`❌ [assign-seat] Notion error details:`, {
        name: notionError instanceof Error ? notionError.name : 'Unknown',
        message: notionError instanceof Error ? notionError.message : String(notionError),
        stack: notionError instanceof Error ? notionError.stack : 'No stack',
        outingId,
        actualSeatField,
        memberId,
        payloadUsed: JSON.stringify(updatePayload, null, 2)
      });
      throw notionError;
    }

    console.log(`✅ Seat assignment successful ${isSub ? '(SUB SEAT)' : ''}:`, {
      pageId: response.id,
      seat,
      actualSeatField,
      memberId: memberId || 'cleared',
      isSub
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