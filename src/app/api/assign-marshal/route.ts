// src/app/api/assign-marshal/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2025-09-03',
});

export async function POST(request: NextRequest) {
  try {
    const { slotId, memberId } = await request.json();

    if (!slotId) {
      return NextResponse.json(
        { error: 'Missing required field: slotId', success: false },
        { status: 400 }
      );
    }

    const properties: Record<string, unknown> = {};

    if (memberId) {
      properties['Person'] = { relation: [{ id: memberId }] };
      // Signup = confirmed. No intermediate approval step.
      properties['Person Status'] = { select: { name: 'Confirmed' } };
    } else {
      properties['Person'] = { relation: [] };
      properties['Person Status'] = { select: { name: 'Open' } };
    }

    await notion.pages.update({
      page_id: slotId,
      properties: properties as any,
    });

    return NextResponse.json({
      success: true,
      message: memberId ? 'Member assigned to marshal slot' : 'Marshal slot cleared',
      slotId,
      memberId,
    });
  } catch (error) {
    console.error('❌ Error assigning marshal slot:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false,
      },
      { status: 500 }
    );
  }
}
