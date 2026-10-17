// src/app/api/assign-seat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { SEAT_PROPERTIES, isSeatStatus } from '@/lib/seatProperties'
import { isNotionPageId } from '../_utils/schemas'
import { readJsonObject } from '../_utils/request'

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

    const body = await readJsonObject(req)
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid JSON body', success: false },
        { status: 400 }
      )
    }
    const { outingId, seat, memberId, status } = body as { outingId?: string; seat?: string; memberId?: string | null; status?: unknown }

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

    // Only known seats may be written: the seat name becomes a Notion property name
    const seatProperties = typeof seat === 'string' && Object.hasOwn(SEAT_PROPERTIES, seat) ? SEAT_PROPERTIES[seat] : undefined
    if (!seatProperties) {
      console.error('❌ Invalid seat:', seat)
      return NextResponse.json(
        { error: 'Invalid seat', success: false },
        { status: 400 }
      )
    }

    // Validate outingId format (should be a valid Notion page ID)
    if (!isNotionPageId(outingId)) {
      console.error('❌ Invalid outingId format:', outingId)
      return NextResponse.json(
        { error: 'Invalid outingId format', success: false },
        { status: 400 }
      )
    }

    // Validate memberId if provided
    if (memberId && !isNotionPageId(memberId)) {
      console.error('❌ Invalid memberId format:', memberId)
      return NextResponse.json(
        { error: 'Invalid memberId format', success: false },
        { status: 400 }
      )
    }

    // Validate status if provided: it is written to the seat's status property in the same update
    const statusProperty = seatProperties.status
    if (status !== undefined && !isSeatStatus(status)) {
      console.error('❌ Invalid status for seat:', { seat, status })
      return NextResponse.json(
        { error: 'Invalid status', success: false },
        { status: 400 }
      )
    }

    const actualSeatField = seatProperties.relation;

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
      ...(status !== undefined ? { [statusProperty]: { status: { name: status } } } : {}),
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
          { error: 'Outing not found', success: false },
          { status: 404 }
        )
      }
      if (error.message.includes('Invalid page_id')) {
        return NextResponse.json(
          { error: 'Invalid outing ID', success: false },
          { status: 400 }
        )
      }
      if (error.message.includes('property does not exist')) {
        return NextResponse.json(
          { error: 'Invalid seat property', success: false },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to assign seat',
        success: false
      },
      { status: 500 }
    )
  }
}