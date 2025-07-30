// src/app/api/update-seat/route.ts

import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { pageId, seatProperty, memberId } = body;

    if (!pageId || !seatProperty || !memberId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    await notion.pages.update({
      page_id: pageId,
      properties: {
        [seatProperty]: {
          type: "relation",
          relation: [{ id: memberId }],
        },
      },
    });

    return NextResponse.json({ message: "Seat updated successfully" });
  } catch (error) {
    console.error("Failed to update seat:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}