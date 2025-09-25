// src/app/api/get-tests/route.ts
import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { Test, TestPageResponse } from '@/types/test'
import { Member } from '@/types/members'
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2025-09-03',
})

export async function GET() {
  try {
    console.log('🔍 Fetching tests from Notion database...')

    // Validate environment variables
    if (!process.env.NOTION_TOKEN) {
      console.error('❌ NOTION_TOKEN is not set')
      return NextResponse.json(
        { error: 'Missing Notion token configuration', success: false },
        { status: 500 }
      )
    }

    const testsDatabaseId = '27980040a8fa8050a61ce835396544f4'
    console.log('🗄️ Retrieving tests database:', testsDatabaseId)

    // First get the database to find data sources
    const databaseResponse = await notion.request({
      method: 'get',
      path: `databases/${testsDatabaseId}`,
    }) as { data_sources?: { id: string }[] }

    if (!databaseResponse.data_sources || databaseResponse.data_sources.length === 0) {
      console.error('❌ No data sources found for tests database')
      return NextResponse.json(
        { error: 'No data sources found for tests database', success: false },
        { status: 500 }
      )
    }

    const dataSourceId = databaseResponse.data_sources[0].id
    console.log(`📊 Using data source: ${dataSourceId}`)

    // Query the data source for test records
    const response = await notion.request({
      method: 'post',
      path: `data_sources/${dataSourceId}/query`,
      body: {
        sorts: [
          {
            property: 'Date',
            direction: 'ascending'
          }
        ]
      }
    }) as {
      results: PageObjectResponse[]
      has_more: boolean
      next_cursor?: string
    }

    console.log(`📝 Found ${response.results.length} test records`)

    // Process each test record
    const tests: Test[] = []

    for (const page of response.results) {
      try {
        const testData = await processTestPage(page)
        if (testData) {
          tests.push(testData)
        }
      } catch (error) {
        console.error(`❌ Error processing test ${page.id}:`, error)
        // Continue processing other tests even if one fails
      }
    }

    console.log(`✅ Successfully processed ${tests.length} tests`)

    return NextResponse.json({
      tests,
      success: true,
      count: tests.length
    })

  } catch (error) {
    console.error('❌ Error in get-tests API:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false
      },
      { status: 500 }
    )
  }
}

async function processTestPage(page: PageObjectResponse): Promise<Test | null> {
  try {
    const properties = page.properties as any

    // Extract basic test information
    const title = properties['OURC Test']?.title?.[0]?.plain_text || 'Untitled Test'
    const type = properties['Type']?.select?.name
    const availableSlots = properties['Available Slots']?.number || 0
    const dateInfo = properties['Date']?.date

    if (!type || !dateInfo?.start) {
      console.warn(`⚠️  Skipping test ${page.id} - missing required fields`)
      return null
    }

    // Process date information
    const startDate = dateInfo.start
    const endDate = dateInfo.end || dateInfo.start
    const isDatetime = startDate.includes('T')

    // Process member relations for each slot
    const memberPromises: Promise<Member[]>[] = []
    for (let i = 1; i <= 6; i++) {
      const slotProperty = properties[`Slot ${i}` as keyof typeof properties] as any
      if (slotProperty?.relation) {
        memberPromises.push(fetchMembersFromRelation(slotProperty.relation))
      } else {
        memberPromises.push(Promise.resolve([]))
      }
    }

    const memberResults = await Promise.all(memberPromises)

    // Extract outcomes for each slot
    const outcomes = {
      slot1: properties['Slot 1 Outcome']?.status?.name,
      slot2: properties['Slot 2 Outcome']?.status?.name,
      slot3: properties['Slot 3 Outcome']?.status?.name,
      slot4: properties['Slot 4 Outcome']?.status?.name,
      slot5: properties['Slot 5 Outcome']?.status?.name,
      slot6: properties['Slot 6 Outcome']?.status?.name,
    }

    const test: Test = {
      id: page.id,
      url: page.url,
      title,
      type,
      availableSlots,
      date: {
        start: startDate,
        end: endDate !== startDate ? endDate : undefined,
        isDatetime,
      },
      slot1: memberResults[0],
      slot2: memberResults[1],
      slot3: memberResults[2],
      slot4: memberResults[3],
      slot5: memberResults[4],
      slot6: memberResults[5],
      slot1Outcome: outcomes.slot1,
      slot2Outcome: outcomes.slot2,
      slot3Outcome: outcomes.slot3,
      slot4Outcome: outcomes.slot4,
      slot5Outcome: outcomes.slot5,
      slot6Outcome: outcomes.slot6,
    }

    return test

  } catch (error) {
    console.error(`Error processing test page ${page.id}:`, error)
    return null
  }
}

async function fetchMembersFromRelation(relationIds: { id: string }[]): Promise<Member[]> {
  if (!relationIds?.length) return []

  try {
    const members: Member[] = []

    for (const relationId of relationIds) {
      try {
        // Fetch the related page (member)
        const memberPage = await notion.pages.retrieve({
          page_id: relationId.id
        }) as PageObjectResponse

        if (memberPage.properties) {
          // Extract member information - adjust property names based on your members database schema
          const nameProperty = memberPage.properties['Name'] || memberPage.properties['Member'] || memberPage.properties['Title']
          const emailProperty = memberPage.properties['Email']
          const typeProperty = memberPage.properties['Type'] || memberPage.properties['Member Type']

          if (nameProperty) {
            let name = ''
            let email = ''
            let memberType = ''

            // Extract name
            if ('title' in nameProperty && nameProperty.title) {
              name = nameProperty.title[0]?.plain_text || ''
            } else if ('rich_text' in nameProperty && nameProperty.rich_text) {
              name = (nameProperty.rich_text as any)[0]?.plain_text || ''
            }

            // Extract email
            if (emailProperty && 'email' in emailProperty) {
              email = (emailProperty as any).email || ''
            } else if (emailProperty && 'rich_text' in emailProperty) {
              email = (emailProperty as any).rich_text?.[0]?.plain_text || ''
            }

            // Extract member type
            if (typeProperty && 'select' in typeProperty) {
              memberType = (typeProperty as any).select?.name || ''
            } else if (typeProperty && 'rich_text' in typeProperty) {
              memberType = (typeProperty as any).rich_text?.[0]?.plain_text || ''
            }

            if (name) {
              members.push({
                id: relationId.id,
                name,
                email,
                memberType
              })
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching member ${relationId.id}:`, error)
        // Continue processing other members
      }
    }

    return members

  } catch (error) {
    console.error('Error fetching members from relation:', error)
    return []
  }
}