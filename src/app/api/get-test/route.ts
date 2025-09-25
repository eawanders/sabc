// src/app/api/get-test/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { Test } from '@/types/test'
import { Member } from '@/types/members'
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2025-09-03',
})

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log('🚀 GET /api/get-test - Request received at:', new Date().toISOString());

  try {
    const { searchParams } = new URL(request.url)
    const testId = searchParams.get('id')

    console.log('🔍 Request URL:', request.url);
    console.log('🔍 Search params:', Object.fromEntries(searchParams.entries()));
    console.log('🔍 Extracted testId:', testId);

    if (!testId) {
      console.log('❌ No test ID provided in request');
      return NextResponse.json(
        { error: 'Test ID is required', success: false },
        { status: 400 }
      )
    }

    console.log('🔍 Fetching test from Notion database:', testId)

    // Validate environment variables
    if (!process.env.NOTION_TOKEN) {
      console.error('❌ NOTION_TOKEN is not set')
      return NextResponse.json(
        { error: 'Missing Notion token configuration', success: false },
        { status: 500 }
      )
    }

    console.log('✅ NOTION_TOKEN is present');

    // Query the specific page directly using page ID
    console.log('📡 Making page request for ID:', testId);

    const pageResponse = await notion.request({
      method: 'get',
      path: `pages/${testId}`,
    }) as PageObjectResponse

    // Convert single page to array format for consistency with existing code
    const response = { results: [pageResponse] }

    console.log(`📋 Query completed. Found ${response.results.length} test(s)`);

    if (response.results.length > 0) {
      console.log('📋 First test result keys:', Object.keys(response.results[0]));
      console.log('📋 First test properties keys:', Object.keys((response.results[0] as any).properties || {}));
    }

    if (response.results.length === 0) {
      console.log('❌ Test not found with ID:', testId);
      return NextResponse.json(
        { error: 'Test not found', success: false },
        { status: 404 }
      )
    }

    const testPage = response.results[0]
    console.log('📋 Processing test page with ID:', testPage.id);

    // Helper function to safely get property values
    const getPropertyValue = (properties: any, key: string): any => {
      const property = properties[key]
      if (!property) return null

      switch (property.type) {
        case 'title':
          return property.title?.[0]?.plain_text || null
        case 'rich_text':
          return property.rich_text?.[0]?.plain_text || null
        case 'select':
          return property.select?.name || null
        case 'multi_select':
          return property.multi_select?.map((item: any) => item.name) || []
        case 'number':
          return property.number
        case 'date':
          return property.date || null
        case 'relation':
          return property.relation || []
        case 'status':
          return property.status?.name || null
        case 'email':
          return property.email || null
        default:
          return null
      }
    }

    // Helper function to convert relation IDs to member objects
    const convertRelationsToMembers = async (relationIds: string[]): Promise<Member[]> => {
      if (!relationIds || relationIds.length === 0) return []

      try {
        // Query each member by ID
        const memberPromises = relationIds.map(async (relationId) => {
          try {
            const memberResponse = await notion.request({
              method: 'get',
              path: `pages/${relationId}`,
            }) as PageObjectResponse

            const memberProperties = (memberResponse as any).properties

            return {
              id: memberResponse.id,
              name: getPropertyValue(memberProperties, 'Full Name') || 'Unknown Member',
              email: getPropertyValue(memberProperties, 'Email Address') || '',
              memberType: getPropertyValue(memberProperties, 'Member Type') || 'Standard',
              coxExperience: getPropertyValue(memberProperties, 'Cox Experience'),
            } as Member
          } catch (error) {
            console.warn(`⚠️ Failed to fetch member ${relationId}:`, error)
            return null
          }
        })

        const members = await Promise.all(memberPromises)
        return members.filter((member): member is Member => member !== null)
      } catch (error) {
        console.warn('⚠️ Failed to convert relations to members:', error)
        return []
      }
    }

    // Extract properties from the test page
    const properties = (testPage as any).properties

    // Convert relation properties to member arrays
    const slot1Members = await convertRelationsToMembers(
      getPropertyValue(properties, 'Slot 1')?.map((rel: any) => rel.id) || []
    )
    const slot2Members = await convertRelationsToMembers(
      getPropertyValue(properties, 'Slot 2')?.map((rel: any) => rel.id) || []
    )
    const slot3Members = await convertRelationsToMembers(
      getPropertyValue(properties, 'Slot 3')?.map((rel: any) => rel.id) || []
    )
    const slot4Members = await convertRelationsToMembers(
      getPropertyValue(properties, 'Slot 4')?.map((rel: any) => rel.id) || []
    )
    const slot5Members = await convertRelationsToMembers(
      getPropertyValue(properties, 'Slot 5')?.map((rel: any) => rel.id) || []
    )
    const slot6Members = await convertRelationsToMembers(
      getPropertyValue(properties, 'Slot 6')?.map((rel: any) => rel.id) || []
    )

    // Create the test object
    const test: Test = {
      id: testPage.id,
      url: testPage.url,
      title: getPropertyValue(properties, 'OURC Test') || 'Untitled Test',
      type: getPropertyValue(properties, 'Type') || 'Swim Test',
      date: getPropertyValue(properties, 'Date') || { start: new Date().toISOString().split('T')[0], isDatetime: false },
      availableSlots: getPropertyValue(properties, 'Available Slots') || 6,
      slot1: slot1Members,
      slot2: slot2Members,
      slot3: slot3Members,
      slot4: slot4Members,
      slot5: slot5Members,
      slot6: slot6Members,
      slot1Outcome: getPropertyValue(properties, 'Slot 1 Outcome'),
      slot2Outcome: getPropertyValue(properties, 'Slot 2 Outcome'),
      slot3Outcome: getPropertyValue(properties, 'Slot 3 Outcome'),
      slot4Outcome: getPropertyValue(properties, 'Slot 4 Outcome'),
      slot5Outcome: getPropertyValue(properties, 'Slot 5 Outcome'),
      slot6Outcome: getPropertyValue(properties, 'Slot 6 Outcome'),
    }

    console.log('✅ Successfully retrieved test:', test.id);
    console.log('⏱️ Total processing time:', Date.now() - startTime, 'ms');

    return NextResponse.json({
      test,
      success: true
    })

  } catch (error) {
    console.error('❌ Error fetching test:', error);
    console.error('❌ Error type:', typeof error);
    console.error('❌ Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.log('⏱️ Failed after:', Date.now() - startTime, 'ms');

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch test',
        success: false,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      },
      { status: 500 }
    )
  }
}