import { Client } from '@notionhq/client';
import { isNotionPageId } from '../_utils/schemas';
import { readJsonObject } from '../_utils/request';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// Seat status fields the client may send (OutingDrawer's getStatusField), mapped to Notion property names
const SEAT_STATUS_FIELDS = new Map<string, string>([
  ['CoxStatus', 'Cox Status'],
  ['StrokeStatus', 'Stroke Status'],
  ['BowStatus', 'Bow Status'],
  ['7 SeatStatus', '7 Seat Status'],
  ['6 SeatStatus', '6 Seat Status'],
  ['5 SeatStatus', '5 Seat Status'],
  ['4 SeatStatus', '4 Seat Status'],
  ['3 SeatStatus', '3 Seat Status'],
  ['2 SeatStatus', '2 Seat Status'],
  ['BankRiderStatus', 'Bank Rider Status'],
  ['Sub1Status', 'Sub 1 Status'],
  ['Sub2Status', 'Sub 2 Status'],
  ['Sub3Status', 'Sub 3 Status'],
  ['Sub4Status', 'Sub 4 Status'],
]);

// The outing-level 'Status' property. OutingDrawer's auto-confirm / de-confirm sends only these two values;
// anything else (e.g. Cancelled) must not be settable through this route.
const OUTING_STATUS_FIELD = 'Status';
const OUTING_STATUS_VALUES = ['Confirmed', 'Provisional'];

export async function POST(req: Request) {
  try {
    console.log('🎯 Starting availability update request...')

    // Validate environment variables
    if (!process.env.NOTION_TOKEN) {
      console.error('❌ NOTION_TOKEN is not set')
      return new Response(
        JSON.stringify({
          error: 'Missing Notion token configuration',
          success: false
        }),
        { status: 500 }
      )
    }

    const body = await readJsonObject(req);
    if (!body) {
      return new Response(
        JSON.stringify({
          error: 'Invalid JSON body',
          success: false
        }),
        { status: 400 }
      );
    }
    console.log("📥 Received availability update request:", body);

    const { outingId, statusField, status } = body as { outingId?: string; statusField?: unknown; status?: string };

    // Validate required fields
    if (!outingId) {
      console.error("❌ Missing outingId in request");
      return new Response(
        JSON.stringify({
          error: "Missing outingId parameter",
          success: false
        }),
        { status: 400 }
      );
    }

    if (!statusField) {
      console.error("❌ Missing statusField in request");
      return new Response(
        JSON.stringify({
          error: "Missing statusField parameter",
          success: false
        }),
        { status: 400 }
      );
    }

    if (!status) {
      console.error("❌ Missing status in request");
      return new Response(
        JSON.stringify({
          error: "Missing status parameter",
          success: false
        }),
        { status: 400 }
      );
    }

    // Validate outingId format
    if (!isNotionPageId(outingId)) {
      console.error('❌ Invalid outingId format:', outingId)
      return new Response(
        JSON.stringify({
          error: 'Invalid outingId format',
          success: false
        }),
        { status: 400 }
      )
    }

    if (typeof statusField !== 'string') {
      return new Response(
        JSON.stringify({
          error: 'Invalid statusField',
          success: false
        }),
        { status: 400 }
      );
    }

    // Try to normalize the status field name (remove spaces if present)
    const normalizedField = statusField.replace(/\s+/g, '');

    // Only known status properties may be written: a seat status, or the outing-level Status
    const isOutingStatus = statusField === OUTING_STATUS_FIELD;
    const actualPropertyName = isOutingStatus
      ? OUTING_STATUS_FIELD
      : SEAT_STATUS_FIELDS.get(statusField) ?? SEAT_STATUS_FIELDS.get(normalizedField);

    if (!actualPropertyName || (isOutingStatus && !OUTING_STATUS_VALUES.includes(status))) {
      console.error('❌ Disallowed status field/value:', { statusField, status });
      return new Response(
        JSON.stringify({
          error: 'Invalid statusField',
          success: false
        }),
        { status: 400 }
      );
    }

    console.log(`🔄 Mapping status field:`, {
      original: statusField,
      normalized: normalizedField,
      mapped: actualPropertyName,
      targetStatus: status
    });

    // Validate status value
    const validStatuses = ['Available', 'Maybe Available', 'Not Available', 'Awaiting Approval', 'Provisional', 'Confirmed', 'Cancelled', 'Reserved'];
    if (!validStatuses.includes(status)) {
      console.error('❌ Invalid status value:', status);
      return new Response(
        JSON.stringify({
          error: `Invalid status value. Must be one of: ${validStatuses.join(', ')}`,
          success: false
        }),
        { status: 400 }
      );
    }

    const updatePayload = {
      [actualPropertyName]: {
        status: { name: status }
      }
    };

    console.log('🔄 Updating Notion page with availability payload:', {
      pageId: outingId,
      properties: updatePayload
    });

    const response = await notion.pages.update({
      page_id: outingId,
      properties: updatePayload
    });

    console.log(`✅ Availability update successful:`, {
      pageId: response.id,
      property: actualPropertyName,
      status: status
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: response.id,
        property: actualPropertyName,
        status: status
      }
    }));
  } catch (error) {
    console.error('❌ Error updating availability:', error);

    // More detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';

    console.error('❌ Availability update error details:', {
      message: errorMessage,
      stack: errorStack,
      notionToken: process.env.NOTION_TOKEN ? 'Present' : 'Missing'
    });

    // Check for specific Notion API errors
    if (error instanceof Error) {
      if (error.message.includes('Could not find page')) {
        return new Response(
          JSON.stringify({
            error: 'Outing not found',
            success: false
          }),
          { status: 404 }
        );
      }
      if (error.message.includes('Invalid page_id')) {
        return new Response(
          JSON.stringify({
            error: 'Invalid outing ID',
            success: false
          }),
          { status: 400 }
        );
      }
      if (
        error.message.includes('property does not exist') ||
        error.message.includes('is not a property that exists') ||
        error.message.includes('not a property')
      ) {
        return new Response(
          JSON.stringify({
            error: 'Invalid availability property',
            success: false
          }),
          { status: 400 }
        );
      }
    }

    return new Response(
      JSON.stringify({
        error: 'Failed to update availability',
        success: false
      }),
      { status: 500 }
    );
  }
}