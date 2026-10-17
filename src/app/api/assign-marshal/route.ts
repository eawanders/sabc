// src/app/api/assign-marshal/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { isNotionPageId } from '../_utils/schemas';
import { readJsonObject } from '../_utils/request';

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2025-09-03',
});

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonObject(request);
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid JSON body', success: false },
        { status: 400 }
      );
    }
    const { slotId, memberId } = body;

    if (!slotId) {
      return NextResponse.json(
        { error: 'Missing required field: slotId', success: false },
        { status: 400 }
      );
    }

    if (!isNotionPageId(slotId) || (memberId && !isNotionPageId(memberId))) {
      return NextResponse.json(
        { error: 'Invalid slotId or memberId', success: false },
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
        error: 'Failed to assign marshal slot',
        success: false,
      },
      { status: 500 }
    );
  }
}
