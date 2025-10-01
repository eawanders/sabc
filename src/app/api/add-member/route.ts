// src/app/api/add-member/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { checkRateLimit } from '../_utils/rate-limit';
import { addMemberSchema } from '../_utils/schemas';
import { handleApiError, getClientIp, createSuccessResponse } from '../_utils/response';
import logger from '../_utils/logger';

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

export async function POST(req: NextRequest) {
  const route = '/api/add-member';
  const ip = getClientIp(req);

  try {
    // 1. Rate limit - prevent abuse
    await checkRateLimit(ip);

    // 2. Validate input with Zod schema
    const body = await req.json();
    const input = addMemberSchema.parse(body);

    logger.info(
      { route, memberName: input.name },
      'Creating new member'
    );

    // 3. Validate environment
    if (!process.env.NOTION_MEMBERS_DB_ID) {
      logger.error({ route }, 'Missing NOTION_MEMBERS_DB_ID');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // 4. Create member in Notion
    const response = await notion.pages.create({
      parent: {
        database_id: process.env.NOTION_MEMBERS_DB_ID,
      },
      properties: {
        'Full Name': {
          title: [
            {
              text: {
                content: input.name.trim(),
              },
            },
          ],
        },
        'Email Address': {
          email: input.email || null,
        },
        'Role': {
          select: {
            name: input.role.charAt(0).toUpperCase() + input.role.slice(1),
          },
        },
        ...(input.college && {
          'College': {
            rich_text: [
              {
                text: {
                  content: input.college,
                },
              },
            ],
          },
        }),
      },
    });

    logger.info(
      { route, memberId: response.id },
      'Member created successfully'
    );

    // 5. Return success response with security headers (no-store cache)
    return createSuccessResponse({
      success: true,
      member: {
        id: response.id,
        name: input.name.trim(),
        email: input.email,
        role: input.role,
      },
    });
  } catch (error) {
    // Handle all errors consistently with PII redaction
    return handleApiError(error, {
      route,
      method: 'POST',
      ip,
    });
  }
}