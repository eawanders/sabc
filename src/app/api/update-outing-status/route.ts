// src/app/api/update-outing-status/route.ts
import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const OUTINGS_DB_ID = process.env.NOTION_OUTINGS_DB_ID;
const FLAG_STATUS_API = 'https://ourcs.co.uk/api/flags/status/isis/';

// Map flag status to Notion outing status
const flagToOutingStatus: Record<string, string> = {
    'Red': 'Cancelled',
    'Black': 'Cancelled',
};

export async function POST() {
  if (!OUTINGS_DB_ID) {
    return NextResponse.json({ error: 'Missing Notion outings database ID' }, { status: 500 });
  }

  // 1. Fetch flag status
  const flagRes = await fetch(FLAG_STATUS_API);
  if (!flagRes.ok) {
    return NextResponse.json({ error: 'Failed to fetch flag status' }, { status: 500 });
  }
  const flagData = await flagRes.json();
  const flagStatus = flagData.status;
  console.log(`[LIVE MODE] Fetched flag status: ${flagStatus}`);
  // Only update if flag is Red or Black
  if (flagStatus !== 'Red' && flagStatus !== 'Black') {
    console.log(`[LIVE MODE] No update performed. Flag status is '${flagStatus}'.`);
    return NextResponse.json({ updated: [], message: `No update performed. Flag status is '${flagStatus}'.` });
  }
  const newOutingStatus = flagToOutingStatus[flagStatus];
  console.log(`[LIVE MODE] Updating outings to status: ${newOutingStatus}`);

  // 2. Query Notion for upcoming water outings
  const now = new Date().toISOString();
  const response = await notion.databases.query({
    database_id: OUTINGS_DB_ID,
    filter: {
      and: [
        {
          property: 'Type',
          select: { equals: 'Water Outing' },
        },
        {
          property: 'Start Date/Time',
          date: { after: now },
        },
      ],
    },
    page_size: 100,
  });

  // 3. Update status for each outing
  const updated: string[] = [];
  for (const page of response.results) {
    if ('id' in page) {
      try {
        await notion.pages.update({
          page_id: page.id,
          properties: {
            Status: {
              status: { name: newOutingStatus },
            },
          },
        });
        updated.push(page.id);
        console.log(`[LIVE MODE] Updated outing: ${page.id}`);
      } catch (err) {
        console.error(`[LIVE MODE] Failed to update outing: ${page.id}`, err);
      }
    }
  }

  return NextResponse.json({ updated, newOutingStatus });
}
