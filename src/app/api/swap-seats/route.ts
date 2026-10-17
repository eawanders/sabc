// src/app/api/swap-seats/route.ts
// Writes several seats' members and statuses on one outing in a single Notion update,
// so a swap either lands completely or not at all.
import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { SEAT_PROPERTIES, isSeatStatus } from '@/lib/seatProperties'
import { isNotionPageId } from '../_utils/schemas'
import { readJsonObject } from '../_utils/request'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

type SeatWrite = { seat: string; memberId: string; status: string }

function badRequest(error: string) {
  return NextResponse.json({ error, success: false }, { status: 400 })
}

export async function POST(req: Request) {
  if (!process.env.NOTION_TOKEN) {
    console.error('❌ NOTION_TOKEN is not set')
    return NextResponse.json({ error: 'Missing Notion token configuration', success: false }, { status: 500 })
  }

  const body = await readJsonObject(req)
  if (!body) return badRequest('Invalid JSON body')
  const outingId = body.outingId
  const seats: unknown = body.seats

  if (!isNotionPageId(outingId)) {
    return badRequest('Invalid outingId')
  }
  if (!Array.isArray(seats) || seats.length < 2) {
    return badRequest('A swap needs at least two seats')
  }

  const properties: Record<string, { relation: { id: string }[] } | { status: { name: string } }> = {}
  for (const entry of seats as Partial<SeatWrite>[]) {
    const seat = entry?.seat
    const fields = typeof seat === 'string' && Object.hasOwn(SEAT_PROPERTIES, seat) ? SEAT_PROPERTIES[seat] : undefined
    if (!fields) return badRequest('Invalid seat')
    if (fields.relation in properties) return badRequest('Each seat may appear only once')
    if (!isNotionPageId(entry.memberId)) return badRequest('Invalid memberId')
    if (!isSeatStatus(entry.status)) return badRequest('Invalid status')

    properties[fields.relation] = { relation: [{ id: entry.memberId }] }
    properties[fields.status] = { status: { name: entry.status } }
  }

  try {
    await notion.pages.update({ page_id: outingId, properties })
    console.log('✅ [swap-seats] Updated seats:', { outingId, seats })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ [swap-seats] Notion update failed:', { outingId, seats, error })
    return NextResponse.json({ error: 'Failed to swap seats', success: false }, { status: 500 })
  }
}
