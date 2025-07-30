// src/app/api/assign-seat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

export async function POST(req: NextRequest) {
  try {
    const { outingId, seat, memberId } = await req.json()

    if (!outingId || !seat) {
      return NextResponse.json(
        { error: 'Missing outingId or seat' },
        { status: 400 }
      )
    }

    console.log('Assigning seat with data:', {
      outingId,
      seat,
      memberId,
      payload: {
        [seat]: {
          relation: memberId ? [{ id: memberId }] : [],
        }
      }
    });

    const response = await notion.pages.update({
      page_id: outingId,
      properties: {
        [seat]: {
          relation: memberId ? [{ id: memberId }] : [],
        },
      },
    })

    return NextResponse.json({ success: true, data: response })
  } catch (error) {
    console.error('Error assigning seat:', {
      error,
      outingId,
      seat,
      memberId
    });
    return NextResponse.json(
      { error: 'Failed to assign seat' },
      { status: 500 }
    )
  }
}