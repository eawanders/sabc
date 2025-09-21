// src/app/api/add-member/route.ts
import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'Member name is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    console.log(`👤 Creating new member: ${name.trim()}`)

    // Validate environment variables
    if (!process.env.NOTION_TOKEN) {
      console.error('❌ NOTION_TOKEN is not set')
      return NextResponse.json(
        { error: 'Missing Notion token configuration' },
        { status: 500 }
      )
    }

    if (!process.env.NOTION_MEMBERS_DB_ID) {
      console.error('❌ NOTION_MEMBERS_DB_ID is not set')
      return NextResponse.json(
        { error: 'Missing Notion members database ID configuration' },
        { status: 500 }
      )
    }

    // Create the new member page in Notion
    const response = await notion.pages.create({
      parent: {
        database_id: process.env.NOTION_MEMBERS_DB_ID,
      },
      properties: {
        'Full Name': {
          title: [
            {
              text: {
                content: name.trim(),
              },
            },
          ],
        },
        'Member Type': {
          multi_select: [
            {
              name: 'Non-Member',
            },
          ],
        },
        'Email Address': {
          email: null,
        },
      },
    })

    console.log(`✅ Successfully created member: ${name.trim()} with ID: ${response.id}`)

    return NextResponse.json({
      success: true,
      member: {
        id: response.id,
        name: name.trim(),
        email: '',
        memberType: 'Non-Member',
      },
    })
  } catch (error) {
    console.error('❌ Error creating member:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        error: 'Failed to create member',
        details: errorMessage,
        success: false,
      },
      { status: 500 }
    )
  }
}