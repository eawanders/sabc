// src/app/api/submit-outing-report/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2025-09-03'
});

export async function POST(req: NextRequest) {
  try {

    // Validate environment variables
    if (!process.env.NOTION_TOKEN) {
      console.error('❌ NOTION_TOKEN is not set');
      return NextResponse.json(
        { error: 'Missing Notion token configuration', success: false },
        { status: 500 }
      );
    }

    const body = await req.json();

    const { outingId, outingSummary, boatFeel, outingSuccesses, nextFocus, coachFeedback } = body;

    // Validate required fields
    if (!outingId) {
      console.error('❌ Missing outingId in request');
      return NextResponse.json(
        { error: 'Missing outingId parameter', success: false },
        { status: 400 }
      );
    }

    // Validate outingId format (should be a valid Notion page ID)
    if (typeof outingId !== 'string' || outingId.length < 32) {
      console.error('❌ Invalid outingId format:', outingId);
      return NextResponse.json(
        { error: 'Invalid outingId format', success: false },
        { status: 400 }
      );
    }

    // Prepare the properties update payload
    // Notion text properties use rich_text format
    const updatePayload: Record<string, { rich_text: { type: 'text'; text: { content: string } }[] }> = {};

    if (outingSummary !== undefined) {
      updatePayload['Outing Summary'] = {
        rich_text: [
          {
            type: 'text',
            text: {
              content: String(outingSummary || '')
            }
          }
        ]
      };
    }

    if (boatFeel !== undefined) {
      updatePayload['Boat Feel'] = {
        rich_text: [
          {
            type: 'text',
            text: {
              content: String(boatFeel || '')
            }
          }
        ]
      };
    }

    if (outingSuccesses !== undefined) {
      updatePayload['Outing Successes'] = {
        rich_text: [
          {
            type: 'text',
            text: {
              content: String(outingSuccesses || '')
            }
          }
        ]
      };
    }

    if (nextFocus !== undefined) {
      updatePayload['Next Focus'] = {
        rich_text: [
          {
            type: 'text',
            text: {
              content: String(nextFocus || '')
            }
          }
        ]
      };
    }

    if (coachFeedback !== undefined) {
      updatePayload['Coach Feedback'] = {
        rich_text: [
          {
            type: 'text',
            text: {
              content: String(coachFeedback || '')
            }
          }
        ]
      };
    }


    const response = await notion.pages.update({
      page_id: outingId,
      properties: updatePayload
    });


    return NextResponse.json({
      success: true,
      data: {
        id: response.id,
        updatedProperties: Object.keys(updatePayload)
      }
    });
  } catch (error) {
    console.error('❌ Error submitting outing report:', error);

    // More detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';

    console.error('❌ Outing report submission error details:', {
      message: errorMessage,
      stack: errorStack,
      notionToken: process.env.NOTION_TOKEN ? 'Present' : 'Missing'
    });

    // Check for specific Notion API errors
    if (error instanceof Error) {
      if (error.message.includes('Could not find page')) {
        return NextResponse.json(
          { error: 'Outing not found', success: false },
          { status: 404 }
        );
      }

      if (error.message.includes('Unauthorized')) {
        return NextResponse.json(
          { error: 'Unauthorized access to outing', success: false },
          { status: 403 }
        );
      }

      if (error.message.includes('property does not exist')) {
        return NextResponse.json(
          { error: 'Invalid report property. Please check the database schema.', success: false },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to submit outing report', success: false },
      { status: 500 }
    );
  }
}