// src/app/api/update-outing-status/route.ts
import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { verifyRequest } from '../_utils/hmac';
import logger, { logSecurityEvent } from '../_utils/logger';
import { getClientIp, handleApiError } from '../_utils/response';

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
  const route = '/api/update-outing-status';
  const ip = getClientIp(req);

  try {
    // Verify HMAC signature (replaces Bearer token authentication)
    const body = await req.text();
    const verification = verifyRequest(req.headers, body);

    if (!verification.valid) {
      logSecurityEvent('INVALID_SIGNATURE', {
        route,
        ip,
        reason: verification.reason,
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info({ route, ip }, 'Cron job authenticated successfully');

    if (!OUTINGS_DB_ID) {
      logger.error({ route }, 'Missing NOTION_OUTINGS_DB_ID');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // 1. Fetch flag status
    const flagRes = await fetch(FLAG_STATUS_API);
    if (!flagRes.ok) {
      logger.error({ route, status: flagRes.status }, 'Failed to fetch flag status');
      return NextResponse.json({ error: 'Failed to fetch flag status' }, { status: 500 });
    }
    const flagData = await flagRes.json();
    const flagStatus = flagData.status;
    logger.info({ route, flagStatus }, 'Fetched flag status');

    // Only update if flag is Red or Black
    if (flagStatus !== 'Red' && flagStatus !== 'Black') {
      logger.info({ route, flagStatus }, 'No update needed - flag status is not Red or Black');
      return NextResponse.json({
        updated: [],
        message: `No update performed. Flag status is '${flagStatus}'.`
      });
    }

    const newOutingStatus = flagToOutingStatus[flagStatus];
    logger.info({ route, newOutingStatus }, 'Updating outings');

    // 2. Get the database to find data sources
    const databaseResponse = await notion.request({
      method: 'get',
      path: `databases/${OUTINGS_DB_ID}`,
    }) as { data_sources?: { id: string }[] }

    if (!databaseResponse.data_sources || databaseResponse.data_sources.length === 0) {
      logger.error({ route }, 'No data sources found for outings database');
      return NextResponse.json(
        { error: 'No data sources found for outings database' },
        { status: 500 }
      )
    }

    const dataSourceId = databaseResponse.data_sources[0].id
    logger.info({ route, dataSourceId }, 'Using data source');

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
        logger.info({ route, outingId: page.id }, 'Updated outing');
      } catch (err) {
        logger.error({ route, outingId: page.id, error: err }, 'Failed to update outing');
      }
    }

    logger.info({ route, count: updated.length }, 'Completed outing status update');
    return NextResponse.json({ updated, newOutingStatus });

  } catch (error) {
    return handleApiError(error, { route, method: 'POST', ip });
  }
}
