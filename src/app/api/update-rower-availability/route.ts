// src/app/api/update-rower-availability/route.ts
import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import {
  UpdateRowerAvailabilityRequest,
  UpdateRowerAvailabilityResponse,
  validateWeeklyAvailability,
  stringifyTimeRanges,
  DAYS_OF_WEEK,
  DAY_LABELS
} from '@/types/rowerAvailability'
import { notionRequest } from '@/server/notion/client'
import { ROWER_AVAILABILITY_TAG } from '@/server/notion/rowerAvailability'
import { isNotionPageId } from '../_utils/schemas'
import { readJsonObject } from '../_utils/request'

export async function POST(request: Request) {
  try {
    console.log('🔄 Updating rower availability...')

    const body = (await readJsonObject(request)) as UpdateRowerAvailabilityRequest | null
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid JSON body', success: false },
        { status: 400 }
      )
    }
    const { memberId, ...weekData } = body

    // Validate input
    if (!memberId) {
      return NextResponse.json(
        { error: 'Missing required field: memberId', success: false },
        { status: 400 }
      )
    }

    if (!isNotionPageId(memberId)) {
      return NextResponse.json(
        { error: 'Invalid memberId', success: false },
        { status: 400 }
      )
    }

    // Validate weekly availability (check for overlaps, max ranges, valid times)
    const validation = validateWeeklyAvailability(weekData)

    if (!validation.valid) {
      const errorMessages = Object.entries(validation.errors)
        .map(([day, error]) => `${DAY_LABELS[day as keyof typeof DAY_LABELS]}: ${error}`)
        .join('; ')

      return NextResponse.json(
        {
          error: 'Validation failed',
          details: errorMessages,
          success: false
        },
        { status: 400 }
      )
    }

    // Build properties object for Notion update
    const properties: Record<string, any> = {}

    for (const day of DAYS_OF_WEEK) {
      const propertyName = `Unavailable ${DAY_LABELS[day]}`
      const timeRanges = weekData[day]

      properties[propertyName] = {
        type: 'rich_text',
        rich_text: [
          {
            type: 'text',
            text: {
              content: stringifyTimeRanges(timeRanges)
            }
          }
        ]
      }
    }

    console.log(`📝 Updating member page: ${memberId}`)

    // Update the member page
    await notionRequest(
      {
        method: 'patch',
        path: `pages/${memberId}`,
        body: { properties }
      },
      'rower-availability.update'
    )

    // Drop the cached all-members availability so the saved week shows straight away
    revalidateTag(ROWER_AVAILABILITY_TAG)

    console.log(`✅ Successfully updated rower availability for member ${memberId}`)

    const response: UpdateRowerAvailabilityResponse = {
      success: true,
      message: 'Successfully updated rower availability',
      availability: {
        memberId,
        ...weekData
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('❌ Error updating rower availability:', error)

    return NextResponse.json(
      {
        error: 'Failed to update rower availability',
        success: false
      },
      { status: 500 }
    )
  }
}
