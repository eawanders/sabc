// src/types/rowerAvailability.ts

export interface TimeRange {
  start: string; // "HH:MM" format (24-hour)
  end: string;   // "HH:MM" format (24-hour)
}

export interface RowerWeeklyAvailability {
  memberId: string;
  memberName?: string;
  monday: TimeRange[];
  tuesday: TimeRange[];
  wednesday: TimeRange[];
  thursday: TimeRange[];
  friday: TimeRange[];
  saturday: TimeRange[];
  sunday: TimeRange[];
}

export interface UpdateRowerAvailabilityRequest {
  memberId: string;
  monday: TimeRange[];
  tuesday: TimeRange[];
  wednesday: TimeRange[];
  thursday: TimeRange[];
  friday: TimeRange[];
  saturday: TimeRange[];
  sunday: TimeRange[];
}

export interface UpdateRowerAvailabilityResponse {
  success: boolean;
  message: string;
  availability?: RowerWeeklyAvailability;
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday'
};

/**
 * Parse time string "HH:MM" to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Format minutes since midnight to "HH:MM"
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Validate time format HH:MM (24-hour)
 */
export function isValidTimeFormat(time: string): boolean {
  const regex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(time);
}

/**
 * Check if a time range is valid (end > start)
 */
export function isValidTimeRange(range: TimeRange): boolean {
  if (!isValidTimeFormat(range.start) || !isValidTimeFormat(range.end)) {
    return false;
  }
  return timeToMinutes(range.end) > timeToMinutes(range.start);
}

/**
 * Check if two time ranges overlap
 */
export function rangesOverlap(range1: TimeRange, range2: TimeRange): boolean {
  const start1 = timeToMinutes(range1.start);
  const end1 = timeToMinutes(range1.end);
  const start2 = timeToMinutes(range2.start);
  const end2 = timeToMinutes(range2.end);

  // Ranges overlap if one starts before the other ends
  return start1 < end2 && start2 < end1;
}

/**
 * Validate an array of time ranges for a day
 * - Max 3 ranges
 * - No overlapping ranges
 * - Valid format and end > start
 */
export function validateDayRanges(ranges: TimeRange[]): { valid: boolean; error?: string } {
  if (ranges.length > 3) {
    return { valid: false, error: 'Maximum 3 time ranges allowed per day' };
  }

  for (const range of ranges) {
    if (!isValidTimeFormat(range.start)) {
      return { valid: false, error: `Invalid start time format: ${range.start}` };
    }
    if (!isValidTimeFormat(range.end)) {
      return { valid: false, error: `Invalid end time format: ${range.end}` };
    }
    if (!isValidTimeRange(range)) {
      return { valid: false, error: `End time must be after start time: ${range.start} - ${range.end}` };
    }
  }

  // Check for overlaps
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      if (rangesOverlap(ranges[i], ranges[j])) {
        return {
          valid: false,
          error: `Time ranges overlap: ${ranges[i].start}-${ranges[i].end} and ${ranges[j].start}-${ranges[j].end}`
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Validate entire weekly availability
 */
export function validateWeeklyAvailability(
  availability: Omit<RowerWeeklyAvailability, 'memberId' | 'memberName'>
): { valid: boolean; errors: Record<DayOfWeek, string> } {
  const errors: Partial<Record<DayOfWeek, string>> = {};

  for (const day of DAYS_OF_WEEK) {
    const validation = validateDayRanges(availability[day]);
    if (!validation.valid && validation.error) {
      errors[day] = validation.error;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors: errors as Record<DayOfWeek, string>
  };
}

/**
 * Parse JSON string to TimeRange array, with fallback to empty array
 */
export function parseTimeRanges(jsonString: string | null | undefined): TimeRange[] {
  if (!jsonString || jsonString.trim() === '') {
    return [];
  }

  try {
    const parsed = JSON.parse(jsonString);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is TimeRange =>
          item &&
          typeof item === 'object' &&
          typeof item.start === 'string' &&
          typeof item.end === 'string'
      );
    }
    return [];
  } catch (error) {
    console.error('Error parsing time ranges:', error);
    return [];
  }
}

/**
 * Stringify TimeRange array to JSON
 */
export function stringifyTimeRanges(ranges: TimeRange[]): string {
  if (!ranges || ranges.length === 0) {
    return '[]';
  }
  return JSON.stringify(ranges);
}
