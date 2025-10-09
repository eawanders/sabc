// src/utils/rowerAvailability.ts
import { TimeRange, DayOfWeek, timeToMinutes } from '@/types/rowerAvailability'
import { Member } from '@/types/members'

/**
 * Get the day of week from a date string
 */
export function getDayOfWeek(dateString: string): DayOfWeek {
  const date = new Date(dateString)
  const dayIndex = date.getDay() // 0 = Sunday, 1 = Monday, etc.

  const dayMap: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return dayMap[dayIndex]
}

/**
 * Check if a specific time falls within a time range
 */
export function isTimeInRange(time: string, range: TimeRange): boolean {
  const timeMinutes = timeToMinutes(time)
  const startMinutes = timeToMinutes(range.start)
  const endMinutes = timeToMinutes(range.end)

  return timeMinutes >= startMinutes && timeMinutes < endMinutes
}

/**
 * Check if a member is unavailable at a specific time on a specific day
 */
export function isRowerUnavailable(
  unavailableRanges: TimeRange[],
  time: string
): boolean {
  return unavailableRanges.some(range => isTimeInRange(time, range))
}

/**
 * Check if a member is available for a session
 * Returns true if the member IS available (not marked as unavailable)
 */
export function isRowerAvailable(
  memberAvailability: Record<DayOfWeek, TimeRange[]>,
  sessionDate: string,
  sessionTime: string
): boolean {
  const dayOfWeek = getDayOfWeek(sessionDate)
  const unavailableRanges = memberAvailability[dayOfWeek] || []

  // If no unavailable ranges, member is available
  if (unavailableRanges.length === 0) {
    return true
  }

  // Member is available if the time does NOT fall in any unavailable range
  return !isRowerUnavailable(unavailableRanges, sessionTime)
}

/**
 * Filter members to only those available for a session
 */
export function getAvailableRowers(
  allMembers: Member[],
  rowerAvailability: Map<string, Record<DayOfWeek, TimeRange[]>>,
  sessionDate: string,
  sessionTime: string
): { available: Member[]; unavailable: Member[] } {
  const available: Member[] = []
  const unavailable: Member[] = []

  for (const member of allMembers) {
    const memberAvail = rowerAvailability.get(member.id)

    if (!memberAvail) {
      // No availability data means they're available
      available.push(member)
    } else if (isRowerAvailable(memberAvail, sessionDate, sessionTime)) {
      available.push(member)
    } else {
      unavailable.push(member)
    }
  }

  return { available, unavailable }
}

/**
 * Extract time from datetime string (supports ISO and custom formats)
 */
export function extractTime(datetime: string): string {
  const date = new Date(datetime)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Format unavailable ranges for display
 */
export function formatUnavailableRanges(ranges: TimeRange[]): string {
  if (ranges.length === 0) return 'Available all day'

  return ranges
    .map(range => `${range.start}-${range.end}`)
    .join(', ')
}
