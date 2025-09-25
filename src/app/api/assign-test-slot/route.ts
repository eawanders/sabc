// src/app/api/assign-test-slot/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2025-09-03',
})

export async function POST(request: NextRequest) {
  try {
    const { testId, slotNumber, memberId } = await request.json()

    // Validate required fields
    if (!testId || !slotNumber || !memberId) {
      return NextResponse.json(
        { error: 'Missing required fields: testId, slotNumber, memberId', success: false },
        { status: 400 }
      )
    }

    if (slotNumber < 1 || slotNumber > 6) {
      return NextResponse.json(
        { error: 'Invalid slot number. Must be between 1 and 6', success: false },
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

    // Get current slot assignments
    const properties = (testPage as any).properties
    const currentSlotProperty = properties[`Slot ${slotNumber}`]
    const currentAssignments = currentSlotProperty?.relation || []

    // Check if member is already assigned to this slot
    const isAlreadyAssigned = currentAssignments.some((rel: any) => rel.id === memberId)

    if (isAlreadyAssigned) {
      return NextResponse.json(
        { error: 'Member is already assigned to this slot', success: false },
        { status: 400 }
      )
    }

    // Add the new member to the slot
    const updatedAssignments = [...currentAssignments, { id: memberId }]

    // Update the test page with new assignment
    const updateData: any = {
      properties: {
        [`Slot ${slotNumber}`]: {
          relation: updatedAssignments
        }
      }
    }

    // Also set the outcome to "Test Booked" if not already set
    const currentOutcome = properties[`Slot ${slotNumber} Outcome`]
    if (!currentOutcome?.status?.name || currentOutcome.status.name === 'No Show') {
      updateData.properties[`Slot ${slotNumber} Outcome`] = {
        status: { name: 'Test Booked' }
      }
    }

    await notion.pages.update({
      page_id: testId,
      ...updateData
    })

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
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false
      },
      { status: 500 }
    )
  }
}