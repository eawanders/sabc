// src/app/api/get-members/route.ts
import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { Member } from '@/types/members'

// Notion property type interfaces
interface NotionTitle {
  type: 'title'
  title: Array<{ plain_text: string }>
}

interface NotionEmail {
  type: 'email'
  email: string
}

interface NotionSelect {
  type: 'select'
  select: { name: string } | null
}

interface NotionMultiSelect {
  type: 'multi_select'
  multi_select: Array<{ name: string }>
}

interface NotionRichText {
  type: 'rich_text'
  rich_text: Array<{ plain_text: string }>
}

type NotionProperty = NotionTitle | NotionEmail | NotionSelect | NotionMultiSelect | NotionRichText

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2025-09-03',
})

export async function GET() {
  try {
    console.log('🔍 Fetching members from Notion database...')

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

    console.log(`🗄️ Retrieving database: ${process.env.NOTION_MEMBERS_DB_ID}`)

    // First get the database to find data sources
    const databaseResponse = await notion.request({
      method: 'get',
      path: `databases/${process.env.NOTION_MEMBERS_DB_ID}`,
    }) as { data_sources?: { id: string }[] }

    if (!databaseResponse.data_sources || databaseResponse.data_sources.length === 0) {
      console.error('❌ No data sources found for members database')
      return NextResponse.json(
        { error: 'No data sources found for members database' },
        { status: 500 }
      )
    }

    const dataSourceId = databaseResponse.data_sources[0].id
    console.log(`📊 Using data source: ${dataSourceId}`)

    // Query the data source
    const response = await notion.request({
      method: 'post',
      path: `data_sources/${dataSourceId}/query`,
      body: {
        page_size: 100, // Increase page size for better performance
      },
    }) as { results: unknown[] }

    console.log(`📊 Raw response: Found ${response.results.length} total results`)

    const results = response.results.filter(
      (r: unknown): r is PageObjectResponse => {
        const obj = r as Record<string, unknown>
        return 'properties' in obj
      }
    )

    console.log(`📋 Filtered results: ${results.length} valid pages`)

    // Helper function to safely extract property values
    const getPropertyValue = (page: PageObjectResponse, propertyName: string, expectedType?: string): NotionProperty | null => {
      const property = page.properties[propertyName]
      if (!property || typeof property !== 'object') return null

      const typedProperty = property as NotionProperty
      if (expectedType && typedProperty.type !== expectedType) return null

      return typedProperty
    }

    const members: Member[] = results.map((page: PageObjectResponse) => {
      try {
        // Safely extract name with fallbacks
        let name = ''
        const nameProperty = getPropertyValue(page, 'Full Name')
        if (nameProperty) {
          if (nameProperty.type === 'title' && 'title' in nameProperty && nameProperty.title && Array.isArray(nameProperty.title)) {
            name = nameProperty.title.map((t: { plain_text: string }) => t.plain_text || '').join('').trim()
          } else if (nameProperty.type === 'rich_text' && 'rich_text' in nameProperty && nameProperty.rich_text && Array.isArray(nameProperty.rich_text)) {
            name = nameProperty.rich_text.map((t: { plain_text: string }) => t.plain_text || '').join('').trim()
          }
        }

        // Safely extract email with fallbacks
        let email = ''
        const emailProperty = getPropertyValue(page, 'Email Address', 'email')
        if (emailProperty && emailProperty.type === 'email' && emailProperty.email) {
          email = emailProperty.email.trim()
        }

        // Safely extract member type with fallbacks
        let memberType = ''
        const memberTypeProperty = getPropertyValue(page, 'Member Type')
        if (memberTypeProperty) {
          if (memberTypeProperty.type === 'select' && 'select' in memberTypeProperty && memberTypeProperty.select?.name) {
            memberType = memberTypeProperty.select.name.trim()
          } else if (memberTypeProperty.type === 'multi_select' && 'multi_select' in memberTypeProperty && memberTypeProperty.multi_select && Array.isArray(memberTypeProperty.multi_select)) {
            // For multi_select, take the first value or join them
            memberType = memberTypeProperty.multi_select.map(item => item.name).join(', ')
          }
        }

        // Safely extract cox experience
        let coxExperience = ''
        const coxExperienceProperty = getPropertyValue(page, 'Cox Experience')
        if (coxExperienceProperty) {
          if (coxExperienceProperty.type === 'select' && 'select' in coxExperienceProperty && coxExperienceProperty.select?.name) {
            coxExperience = coxExperienceProperty.select.name.trim()
          }
        }

        const member: Member = {
          id: page.id,
          name,
          email,
          memberType,
          coxExperience: coxExperience || undefined,
        }

        console.log(`👤 Processed member: ${member.name} (${member.memberType})`)
        return member
      } catch (memberError) {
        console.error('❌ Error processing member:', memberError, 'Page ID:', page.id)
        // Return a valid member object even if there's an error
        return {
          id: page.id,
          name: 'Unknown Member',
          email: '',
          memberType: 'Unknown',
        }
      }
    }).filter((member: Member) => member.name && member.name !== 'Unknown Member') // Filter out invalid members

    console.log(`✅ Successfully processed ${members.length} members`)

    return NextResponse.json({
      members,
      total: members.length,
      success: true
    })
  } catch (error) {
    console.error('❌ Error fetching members from Notion:', error)

    // More detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : ''

    console.error('❌ Error details:', {
      message: errorMessage,
      stack: errorStack,
      notionToken: process.env.NOTION_TOKEN ? 'Present' : 'Missing',
      databaseId: process.env.NOTION_MEMBERS_DB_ID ? 'Present' : 'Missing'
    })

    return NextResponse.json(
      {
        error: 'Failed to fetch members',
        details: errorMessage,
        success: false
      },
      { status: 500 }
    )
  }
}