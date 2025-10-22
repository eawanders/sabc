// src/app/api/assign-seat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

export async function POST(req: NextRequest) {
  try {


    if (isSub) {
    }

    const updatePayload = {
      [actualSeatField]: {
        relation: memberId ? [{ id: memberId }] : [],
      }
    }


    let response;
    try {
      response = await notion.pages.update({
        page_id: outingId,
        properties: updatePayload,
      })
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

    try {
      const verifyResponse = await notion.pages.retrieve({ page_id: outingId });
      const properties = (verifyResponse as any).properties;
      const updatedProperty = properties[actualSeatField];


      // Check if the value actually matches what we tried to set
      const actualRelationIds = updatedProperty?.relation?.map((r: any) => r.id) || [];
      const expectedRelationIds = memberId ? [memberId] : [];
      const valuesMatch = JSON.stringify(actualRelationIds.sort()) === JSON.stringify(expectedRelationIds.sort());

      if (!valuesMatch) {
      } else {
      }
    } catch (verifyError) {
      console.error(`❌ [assign-seat] Failed to verify property update:`, verifyError);
    }

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