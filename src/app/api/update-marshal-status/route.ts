// src/app/api/update-marshal-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import type { MarshalPersonStatus } from '@/types/marshal';

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2025-09-03',
});

const VALID_STATUSES: MarshalPersonStatus[] = [
  'Open',
  'Reserved',
  'Maybe Available',
  'Awaiting Approval',
  'Confirmed',
  'Not Available',
];

export async function POST(request: NextRequest) {
  try {
    const { slotId, status } = await request.json();

    if (!slotId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: slotId, status', success: false },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.includes(status as MarshalPersonStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
          success: false,
        },
        { status: 400 }
      );
    }

    await notion.pages.update({
      page_id: slotId,
      properties: {
        'Person Status': { select: { name: status } },
      } as any,
    });

    return NextResponse.json({
      success: true,
      message: `Marshal slot status updated to ${status}`,
      slotId,
      status,
    });
  } catch (error) {
    console.error('❌ Error updating marshal status:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false,
      },
      { status: 500 }
    );
  }
}
