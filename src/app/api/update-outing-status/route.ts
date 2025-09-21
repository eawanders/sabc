// src/app/api/update-outing-status/route.ts
import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2025-09-03'
});
const OUTINGS_DB_ID = process.env.NOTION_OUTINGS_DB_ID;
const FLAG_STATUS_API = 'https://ourcs.co.uk/api/flags/status/isis/';

// Map flag status to Notion outing status
const flagToOutingStatus: Record<string, string> = {
    'Red': 'Cancelled',
    'Black': 'Cancelled',
};

export async function POST(req: Request) {
  // Require a shared secret token in the Authorization header
  const authHeader = req.headers.get('authorization') || '';
  const primary = process.env.UPDATE_OUTING_STATUS_SECRET || '';
  const fallback = process.env.UPDATE_OUTING_STATUS_REPO || '';
  if (!primary && !fallback) {
    return NextResponse.json({ error: 'Server misconfiguration: missing UPDATE_OUTING_STATUS_SECRET (or UPDATE_OUTING_STATUS_REPO)' }, { status: 500 });
  }
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const valid = (token && (token === primary || token === fallback));
  if (!valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  // 2. Get the database to find data sources
  const databaseResponse = await notion.request({
    method: 'get',
    path: `databases/${OUTINGS_DB_ID}`,
  }) as { data_sources?: { id: string }[] }

  if (!databaseResponse.data_sources || databaseResponse.data_sources.length === 0) {
    console.error('❌ No data sources found for outings database')
    return NextResponse.json(
      { error: 'No data sources found for outings database' },
      { status: 500 }
    )
  }

  const dataSourceId = databaseResponse.data_sources[0].id
  console.log(`📊 Using data source: ${dataSourceId}`)

  // Query the data source for upcoming water outings
  const now = new Date().toISOString();
  const response = await notion.request({
    method: 'post',
    path: `data_sources/${dataSourceId}/query`,
    body: {
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
    },
  }) as { results: { id: string }[] }

  // 3. Update status for each outing
  const updated: string[] = [];
  for (const page of response.results) {
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

  return NextResponse.json({ updated, newOutingStatus });
}
