// src/app/api/get-members/route.ts
import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
})

export async function GET() {
  try {
    const response = await notion.databases.query({
      database_id: process.env.NOTION_MEMBERS_DB_ID!,
    })

    const members = response.results.map((page) => {
      return {
        id: page.id,
        name: page.properties["Full Name"]?.title?.[0]?.plain_text || 'Unnamed',
      }
    })

    return NextResponse.json(members)
  } catch (error) {
    console.error('Error fetching members from Notion:', error)
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    )
  }
}