// src/app/api/update-test-outcome/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { TestOutcome } from '@/types/test'
import { isNotionPageId } from '../_utils/schemas'
import { readJsonObject } from '../_utils/request'

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2025-09-03',
})

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonObject(request)
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid JSON body', success: false },
        { status: 400 }
      )
    }
    const { testId, slotNumber, outcome } = body as { testId?: string; slotNumber?: number; outcome?: string }

    // Validate required fields
    if (!testId || !slotNumber) {
      return NextResponse.json(
        { error: 'Missing required fields: testId, slotNumber', success: false },
        { status: 400 }
      )
    }

    if (!Number.isInteger(slotNumber) || slotNumber < 1 || slotNumber > 6) {
      return NextResponse.json(
        { error: 'Invalid slot number. Must be between 1 and 6', success: false },
        { status: 400 }
      )
    }

    if (!isNotionPageId(testId)) {
      return NextResponse.json(
        { error: 'Invalid testId', success: false },
        { status: 400 }
      )
    }

    // If outcome is falsy, treat as 'No Show' (cleared)
    const validOutcomes: TestOutcome[] = ['No Show', 'Test Booked', 'Failed', 'Passed']
    const finalOutcome = outcome || 'No Show'
    if (!validOutcomes.includes(finalOutcome as TestOutcome)) {
      return NextResponse.json(
        { error: `Invalid outcome. Must be one of: ${validOutcomes.join(', ')}`, success: false },
        { status: 400 }
      )
    }

    console.log(`📝 Updating test ${testId}, slot ${slotNumber} outcome to: ${outcome}`)

    // Update the test outcome (set to finalOutcome)
    await notion.pages.update({
      page_id: testId,
      properties: {
        [`Slot ${slotNumber} Outcome`]: {
          status: { name: finalOutcome }
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
        error: 'Failed to update test outcome',
        success: false
      },
      { status: 500 }
    )
  }
}