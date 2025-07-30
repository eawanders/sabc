// src/app/api/get-outings/route.ts
import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
})

export async function GET() {
  try {
    const response = await notion.databases.query({
      database_id: process.env.NOTION_OUTINGS_DB_ID!,
      filter: {
        property: 'Publish Outing',
        checkbox: {
          equals: true,
        },
      },
    })

    console.log(
      "Fetched outings from Notion:",
      JSON.stringify(response.results, null, 2)
    )
    return NextResponse.json(response.results)
  } catch (error) {
    console.error('Error fetching outings from Notion:', error)
    return NextResponse.json(
      { error: 'Failed to fetch outings' },
      { status: 500 }
    )
  }
}