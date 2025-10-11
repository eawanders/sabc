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
 * Check if two time ranges overlap
 * Returns true if there is ANY overlap between the ranges
 *
 * Examples:
 * - sessionRange: 07:15-09:00, unavailableRange: 08:45-12:00 → true (overlap at end)
 * - sessionRange: 08:00-10:00, unavailableRange: 07:00-08:30 → true (overlap at start)
 * - sessionRange: 07:00-10:00, unavailableRange: 08:00-09:00 → true (unavailable contained within)
 * - sessionRange: 08:00-09:00, unavailableRange: 07:00-10:00 → true (session contained within)
 * - sessionRange: 07:00-08:00, unavailableRange: 09:00-10:00 → false (no overlap)
 */
export function doTimeRangesOverlap(sessionRange: TimeRange, unavailableRange: TimeRange): boolean {
  const sessionStartMinutes = timeToMinutes(sessionRange.start)
  const sessionEndMinutes = timeToMinutes(sessionRange.end)
  const unavailableStartMinutes = timeToMinutes(unavailableRange.start)
  const unavailableEndMinutes = timeToMinutes(unavailableRange.end)

  // Ranges overlap if: sessionStart < unavailableEnd AND sessionEnd > unavailableStart
  return sessionStartMinutes < unavailableEndMinutes && sessionEndMinutes > unavailableStartMinutes
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
 * Check if a member has any unavailability that overlaps with a session time range
 */
export function isRowerUnavailableForSession(
  unavailableRanges: TimeRange[],
  sessionRange: TimeRange
): boolean {
  return unavailableRanges.some(range => doTimeRangesOverlap(sessionRange, range))
}

/**
 * Check if a member is available for a session
 * Returns true if the member IS available (not marked as unavailable)
 *
 * @param memberAvailability - Record of unavailable time ranges per day of week
 * @param sessionDate - Date of the session (e.g., "2025-10-15")
 * @param sessionStartTime - Start time of session in HH:MM format (e.g., "07:15")
 * @param sessionEndTime - Optional end time of session in HH:MM format (e.g., "09:00")
 *                         If not provided, falls back to point-in-time check
 */
export function isRowerAvailable(
  memberAvailability: Record<DayOfWeek, TimeRange[]>,
  sessionDate: string,
  sessionStartTime: string,
  sessionEndTime?: string
): boolean {
  const dayOfWeek = getDayOfWeek(sessionDate)
  const unavailableRanges = memberAvailability[dayOfWeek] || []

  // If no unavailable ranges, member is available
  if (unavailableRanges.length === 0) {
    return true
  }

  // If end time is provided, check for range overlap
  if (sessionEndTime) {
    const sessionRange: TimeRange = {
      start: sessionStartTime,
      end: sessionEndTime
    }
    // Member is available if their unavailability does NOT overlap with the session
    return !isRowerUnavailableForSession(unavailableRanges, sessionRange)
  }

  // Fallback: Member is available if the start time does NOT fall in any unavailable range
  return !isRowerUnavailable(unavailableRanges, sessionStartTime)
}

/**
 * Filter members to only those available for a session
 *
 * @param allMembers - All members to check
 * @param rowerAvailability - Map of member unavailability data
 * @param sessionDate - Date of the session
 * @param sessionStartTime - Start time in HH:MM format
 * @param sessionEndTime - Optional end time in HH:MM format for overlap checking
 */
export function getAvailableRowers(
  allMembers: Member[],
  rowerAvailability: Map<string, Record<DayOfWeek, TimeRange[]>>,
  sessionDate: string,
  sessionStartTime: string,
  sessionEndTime?: string
): { available: Member[]; unavailable: Member[] } {
  const available: Member[] = []
  const unavailable: Member[] = []

  for (const member of allMembers) {
    const memberAvail = rowerAvailability.get(member.id)

    if (!memberAvail) {
      // No availability data means they're available
      available.push(member)
    } else if (isRowerAvailable(memberAvail, sessionDate, sessionStartTime, sessionEndTime)) {
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
