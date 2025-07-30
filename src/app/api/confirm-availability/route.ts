// src/app/api/confirm-availability/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

export async function POST(req: NextRequest) {
  try {
    const { outingId, seat, status } = await req.json()

    if (!outingId || !seat || !status) {
      return NextResponse.json(
        { error: 'Missing outingId, seat, or status' },
        { status: 400 }
      )
    }

    const statusField = `${seat} Status`

    const response = await notion.pages.update({
      page_id: outingId,
      properties: {
        [statusField]: {
          status: {
            name: status, // e.g., "Available", "Not Available"
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: response })
  } catch (error) {
    console.error('Error updating availability:', error)
    return NextResponse.json(
      { error: 'Failed to update availability' },
      { status: 500 }
    )
  }
}