import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export async function POST(req: Request) {
  const body = await req.json();
  console.log("📥 Received API request:", body);

  const { outingId, statusField, status } = body;

  if (!outingId || !statusField || !status) {
    console.error("❌ Missing fields in API request", { outingId, statusField, status });
    return new Response(JSON.stringify({ error: "Missing outingId, statusField, or status" }), { status: 400 });
  }

  // Map frontend status field names to actual Notion property names
  const statusFieldMapping: Record<string, string> = {
    'CoxStatus': 'Cox Status',
    'StrokeStatus': 'Stroke Status',
    'BowStatus': 'Bow Status',
    '7 SeatStatus': '7 Seat Status',
    '6 SeatStatus': '6 Seat Status',
    '5 SeatStatus': '5 Seat Status',
    '4 SeatStatus': '4 Seat Status',
    '3 SeatStatus': '3 Seat Status',
    '2 SeatStatus': '2 Seat Status',
    'BankRiderStatus': 'Bank Rider Status',
    'Sub1Status': 'Sub 1 Status',
    'Sub2Status': 'Sub 2 Status',
    'Sub3Status': 'Sub 3 Status',
    'Sub4Status': 'Sub 4 Status'
  };

  // Try to normalize the status field name (remove spaces if present)
  const normalizedField = statusField.replace(/\s+/g, '');

  // Try different variations of the field name to ensure we find the right one
  const actualPropertyName = statusFieldMapping[statusField] ||
                          statusFieldMapping[normalizedField] ||
                          statusField;

  console.log(`🔄 Mapping ${statusField} to ${actualPropertyName}`);

  // For debugging - log all property names to help diagnose mapping issues
  console.log(`📊 Status field mapping options:`, {
    original: statusField,
    normalized: normalizedField,
    mapped: actualPropertyName
  });

  try {
    const response = await notion.pages.update({
      page_id: outingId,
      properties: {
        [actualPropertyName]: {
          status: { name: status }
        }
      }
    });

    console.log(`✅ Successfully updated ${actualPropertyName} to ${status}`);
    return new Response(JSON.stringify({ success: true, data: response }));
  } catch (error) {
    console.error('Failed to update availability:', error);
    return new Response(JSON.stringify({ error: 'Failed to update availability' }), { status: 500 });
  }
}