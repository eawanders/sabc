// src/app/api/get-test/route.ts
// @ts-nocheck
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

  try {
    const { searchParams } = new URL(request.url)
    const testId = searchParams.get('id')


    if (!testId) {
      return NextResponse.json(
        { error: 'Test ID is required', success: false },
        { status: 400 }
      )
    }


    // Query the specific page directly using page ID
    console.log('📡 Making page request for ID:', testId);

    const pageResponse = await notion.request({
      method: 'get',
      path: `pages/${testId}`,
    }) as PageObjectResponse

    // Convert single page to array format for consistency with existing code
    const response = { results: [pageResponse] }


    if (response.results.length > 0) {
      const firstResult = response.results[0] as {properties?: Record<string, unknown>};
    }

    if (response.results.length === 0) {
      return NextResponse.json(
        { error: 'Test not found', success: false },
        { status: 404 }
      )
    }

    const testPage = response.results[0]

    // Helper function to safely get property values
    const getPropertyValue = (properties: Record<string, unknown>, key: string): unknown => {
      const property = properties[key] as {type: string; [key: string]: unknown};
      if (!property) return null

      switch (property.type) {
        case 'title':
          const titleProp = property as {title?: Array<{plain_text?: string}>};
          return titleProp.title?.[0]?.plain_text || null
        case 'rich_text':
          const richTextProp = property as {rich_text?: Array<{plain_text?: string}>};
          return richTextProp.rich_text?.[0]?.plain_text || null
        case 'select':
          const selectProp = property as {select?: {name?: string}};
          return selectProp.select?.name || null
        case 'multi_select':
          const multiSelectProp = property as {multi_select?: Array<{name?: string}>};
          return multiSelectProp.multi_select?.map((item) => item.name) || []
        case 'number':
          const numberProp = property as {number?: number};
          return numberProp.number
        case 'date':
          const dateProp = property as {date?: unknown};
          return dateProp.date || null
        case 'relation':
          const relationProp = property as {relation?: Array<unknown>};
          return relationProp.relation || []
        case 'status':
          const statusProp = property as {status?: {name?: string}};
          return statusProp.status?.name || null
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

    return NextResponse.json({
      test,
      success: true
    })

  } catch (error) {
    console.error('❌ Error fetching test:', error);
    console.error('❌ Error type:', typeof error);
    console.error('❌ Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');

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