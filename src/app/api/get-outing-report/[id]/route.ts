// src/app/api/get-outing-report/[id]/route.ts

import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

// Type definitions for Notion API responses
interface NotionRichTextItem {
  type: string;
  plain_text: string;
  [key: string]: unknown;
}

interface NotionRichTextProperty {
  rich_text: NotionRichTextItem[];
  [key: string]: unknown;
}

interface NotionPageProperties {
  [key: string]: NotionRichTextProperty | unknown;
}

interface NotionPageResponse {
  properties: NotionPageProperties;
  [key: string]: unknown;
}

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2025-09-03'
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🎯 Fetching outing report data...');

    const { id } = await params;

    // Validate environment variables
    if (!process.env.NOTION_TOKEN) {
      console.error('❌ NOTION_TOKEN is not set');
      return NextResponse.json(
        { error: 'Missing Notion token configuration', success: false },
        { status: 500 }
      );
    }

    if (!id) {
      console.error('❌ Missing outingId in request');
      return NextResponse.json(
        { error: 'Missing outingId parameter', success: false },
        { status: 400 }
      );
    }

    // Validate outingId format (should be a valid Notion page ID)
    if (typeof id !== 'string' || id.length < 32) {
      console.error('❌ Invalid outingId format:', id);
      return NextResponse.json(
        { error: 'Invalid outingId format', success: false },
        { status: 400 }
      );
    }

    console.log('🔍 Fetching report data for outing:', id);

    // Fetch the outing page from Notion
    const response = await notion.pages.retrieve({
      page_id: id,
    });

    // Type guard to ensure we have properties
    if (!('properties' in response)) {
      return NextResponse.json(
        { error: 'Invalid page response', success: false },
        { status: 404 }
      );
    }

    const page = response as NotionPageResponse;

    // Helper function to extract rich text content
    const extractRichText = (property: unknown): string => {
      if (!property || typeof property !== 'object' || property === null) {
        return '';
      }

      const richTextProp = property as NotionRichTextProperty;
      if (!richTextProp.rich_text || !Array.isArray(richTextProp.rich_text)) {
        return '';
      }

      return richTextProp.rich_text.map((text: NotionRichTextItem) => text.plain_text || '').join('');
    };

    // Extract the report fields
    const reportData = {
      outingSummary: extractRichText(page.properties['Outing Summary']),
      boatFeel: extractRichText(page.properties['Boat Feel']),
      outingSuccesses: extractRichText(page.properties['Outing Successes']),
      nextFocus: extractRichText(page.properties['Next Focus']),
      coachFeedback: extractRichText(page.properties['Coach Feedback'])
    };

    console.log(`✅ Successfully fetched report data for ${id}:`, reportData);

    return NextResponse.json({
      success: true,
      data: reportData
    });
  } catch (error) {
    console.error('❌ Error fetching outing report:', error);

    // More detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';

    console.error('❌ Outing report fetch error details:', {
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
    }

    return NextResponse.json(
      { error: 'Failed to fetch outing report', success: false },
      { status: 500 }
    );
  }
}