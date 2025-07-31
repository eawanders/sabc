// src/app/api/get-members/route.ts
import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { Member } from '@/types/members'

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
})

export async function GET() {
  try {
    const response = await notion.databases.query({
      database_id: process.env.NOTION_MEMBERS_DB_ID!,
    })

    const results = response.results.filter(
      (r): r is PageObjectResponse => 'properties' in r
    )

    const members: Member[] = results.map((page) => ({
      id: page.id,
      name:
        page.properties['Full Name'].type === 'title'
          ? page.properties['Full Name'].title.map(t => t.plain_text).join('')
          : '',
      email:
        page.properties['Email Address'].type === 'email'
          ? page.properties['Email Address'].email || ''
          : '',
      memberType:
        page.properties['Member Type'].type === 'select'
          ? page.properties['Member Type'].select?.name || ''
          : '',
    }))

    return NextResponse.json({ members })
  } catch (error) {
    console.error('Error fetching members from Notion:', error)
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    )
  }
}