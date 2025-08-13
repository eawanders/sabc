// src/lib/date.ts

/**
 * Date utility functions for calendar operations
 */

/**
 * Gets the start of the week (Monday) for a given date
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  // Set to start of day
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Gets the end of the week (Sunday) for a given date
 */
export function getWeekEnd(date: Date): Date {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  // Set to end of day
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

/**
 * Formats a date range for display (e.g., "02 - 08 March")
 */
export function formatWeekRange(startDate: Date, endDate: Date): string {
  const startDay = startDate.getDate().toString().padStart(2, '0');
  const endDay = endDate.getDate().toString().padStart(2, '0');
  const month = endDate.toLocaleDateString('en-GB', { month: 'long' });

  return `${startDay} - ${endDay} ${month}`;
}

/**
 * Gets array of 7 days for a week starting from the given date
 */
export function getWeekDays(weekStart: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    days.push(day);
  }
  return days;
}

/**
 * Formats time for display (e.g., "10:00")
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Formats time range for display (e.g., "10:00-12:00")
 */
export function formatTimeRange(startTime: Date, endTime: Date): string {
  return `${formatTime(startTime)}-${formatTime(endTime)}`;
}

/**
 * Gets day name abbreviation (e.g., "Mon", "Tue")
 */
export function getDayNameShort(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'short' });
}

/**
 * Checks if a date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

/**
 * Checks if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return date1.toDateString() === date2.toDateString();
}

/**
 * Gets the current week's start date
 */
export function getCurrentWeekStart(): Date {
  return getWeekStart(new Date());
}
