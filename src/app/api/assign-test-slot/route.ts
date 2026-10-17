// src/app/api/assign-test-slot/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
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
    const { testId, slotNumber, memberId } = body as { testId?: string; slotNumber?: number; memberId?: string | null }

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

    if (!isNotionPageId(testId) || (memberId && !isNotionPageId(memberId))) {
      return NextResponse.json(
        { error: 'Invalid testId or memberId', success: false },
        { status: 400 }
      )
    }

    console.log(`🎯 Assigning member ${memberId} to slot ${slotNumber} in test ${testId}`)

    // First get the current test to check existing assignments
    const testPage = await notion.pages.retrieve({ page_id: testId })

    if (!testPage) {
      return NextResponse.json(
        { error: 'Test not found', success: false },
        { status: 404 }
      )
    }


    // Build the update payload: overwrite the relation for the slot.
    // If memberId is falsy (null/empty), we will clear the relation (unassign).
    const updateData: { properties: Record<string, { relation: { id: string }[] } | { status: { name: string } }> } = { properties: {} }

    if (memberId) {
      updateData.properties[`Slot ${slotNumber}`] = { relation: [{ id: memberId }] }
    } else {
      // Clear the relation
      updateData.properties[`Slot ${slotNumber}`] = { relation: [] }
    }

    try {
      console.log('[assign-test-slot] update payload', JSON.stringify(updateData));
    } catch (e) {
      // swallow
    }

    // If memberId is provided, set the Slot Outcome to 'Test Booked' unless it's already a passed/failed value.
    // If clearing the member (memberId falsy), set outcome to 'No Show' to indicate unassigned/cleared.
    const currentOutcome = (testPage as { properties?: Record<string, { status?: { name?: string } }> }).properties?.[`Slot ${slotNumber} Outcome`]
    const currentOutcomeName = currentOutcome?.status?.name

    if (memberId) {
      const skipSet = currentOutcomeName && ['Passed', 'Failed', 'Test Booked'].includes(currentOutcomeName)
      if (!skipSet) {
        updateData.properties[`Slot ${slotNumber} Outcome`] = { status: { name: 'Test Booked' } }
      }
    } else {
      // Clearing member - set to 'No Show' to make intent explicit
      updateData.properties[`Slot ${slotNumber} Outcome`] = { status: { name: 'No Show' } }
    }

    await notion.pages.update({ page_id: testId, ...updateData })

    console.log(`✅ Successfully assigned member to test slot`)

    return NextResponse.json({
      success: true,
      message: `Member assigned to slot ${slotNumber}`,
      testId,
      slotNumber,
      memberId
    })

  } catch (error) {
    console.error('❌ Error assigning test slot:', error)
    return NextResponse.json(
      {
        error: 'Failed to assign test slot',
        success: false
      },
      { status: 500 }
    )
  }
}