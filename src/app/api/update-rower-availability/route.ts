// src/app/api/update-rower-availability/route.ts
import { NextResponse } from 'next/server'
import {
  UpdateRowerAvailabilityRequest,
  UpdateRowerAvailabilityResponse,
  validateWeeklyAvailability,
  stringifyTimeRanges,
  DAYS_OF_WEEK,
  DAY_LABELS
} from '@/types/rowerAvailability'
import { notionRequest } from '@/server/notion/client'

export async function POST(request: Request) {
  try {