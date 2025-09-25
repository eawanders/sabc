// src/app/api/update-test-outcome/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { TestOutcome } from '@/types/test'

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2025-09-03',
})

export async function POST(request: NextRequest) {
  try {
    const { testId, slotNumber, outcome } = await request.json()

    // Validate required fields
    if (!testId || !slotNumber || !outcome) {
      return NextResponse.json(
        { error: 'Missing required fields: testId, slotNumber, outcome', success: false },
        { status: 400 }
      )
    }

    if (slotNumber < 1 || slotNumber > 6) {
      return NextResponse.json(
        { error: 'Invalid slot number. Must be between 1 and 6', success: false },
        { status: 400 }
      )
    }

    const validOutcomes: TestOutcome[] = ['No Show', 'Test Booked', 'Failed', 'Passed']
    if (!validOutcomes.includes(outcome)) {
      return NextResponse.json(
        { error: `Invalid outcome. Must be one of: ${validOutcomes.join(', ')}`, success: false },
        { status: 400 }
      )
    }

    console.log(`📝 Updating test ${testId}, slot ${slotNumber} outcome to: ${outcome}`)

    // Update the test outcome
    await notion.pages.update({
      page_id: testId,
      properties: {
        [`Slot ${slotNumber} Outcome`]: {
          status: { name: outcome }
        }
      }
    })

    console.log(`✅ Successfully updated test outcome`)

    return NextResponse.json({
      success: true,
      message: `Slot ${slotNumber} outcome updated to ${outcome}`,
      testId,
      slotNumber,
      outcome
    })

  } catch (error) {
    console.error('❌ Error updating test outcome:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false
      },
      { status: 500 }
    )
  }
}