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

  try {
const response = await notion.pages.update({
  page_id: outingId,
  properties: {
    [statusField]: {
      status: { name: status }
    }
  }
});

    return new Response(JSON.stringify({ success: true, data: response }));
  } catch (error) {
    console.error('Failed to update availability:', error);
    return new Response(JSON.stringify({ error: 'Failed to update availability' }), { status: 500 });
  }
}