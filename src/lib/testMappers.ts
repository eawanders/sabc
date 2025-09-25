// src/lib/testMappers.ts

import { Test, TestCalendarEvent, TestFilterType } from '@/types/test';
import { isSameDay, parseISO } from '@/lib/date';

/**
 * Convert Test objects to TestCalendarEvent objects for calendar display
 */
export function mapTestsToEvents(tests: Test[]): TestCalendarEvent[] {
  return tests.map(test => {
    // Parse dates
    const startDate = parseISO(test.date.start);
    const endDate = test.date.end ? parseISO(test.date.end) : startDate;

    // Count booked slots
    const bookedSlots = countBookedSlots(test);

    // Determine status
    let status: 'Available' | 'Full' | 'Cancelled' = 'Available';
    if (bookedSlots >= test.availableSlots) {
      status = 'Full';
    }

    // Set color based on test type and status
    const color = getTestEventColor(test.type, status);

    return {
      id: test.id,
      title: test.title,
      startTime: startDate,
      endTime: endDate,
      type: test.type,
      availableSlots: test.availableSlots,
      bookedSlots,
      status,
      color,
      isPublished: true, // Assume all tests are published
      originalTest: test.id
    };
  });
}

/**
 * Filter test events by date range
 */
export function filterTestEventsByDateRange(
  events: TestCalendarEvent[],
  startDate: Date,
  endDate: Date
): TestCalendarEvent[] {
  return events.filter(event => {
    return (event.startTime >= startDate && event.startTime <= endDate) ||
           (event.endTime >= startDate && event.endTime <= endDate) ||
           (event.startTime <= startDate && event.endTime >= endDate);
  });
}

/**
 * Filter test events by test type
 */
export function filterTestEventsByType(
  events: TestCalendarEvent[],
  filterType: TestFilterType
): TestCalendarEvent[] {
  if (filterType === 'All') {
    return events;
  }
  return events.filter(event => event.type === filterType);
}

/**
 * Group test events by date key (YYYY-MM-DD)
 */
export function groupTestEventsByDate(events: TestCalendarEvent[]): Record<string, TestCalendarEvent[]> {
  const grouped: Record<string, TestCalendarEvent[]> = {};

  events.forEach(event => {
    const date = event.startTime;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;

    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(event);
  });

  return grouped;
}

/**
 * Sort test events by start time
 */
export function sortTestEventsByTime(events: TestCalendarEvent[]): TestCalendarEvent[] {
  return [...events].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

/**
 * Count how many slots are booked for a test
 */
function countBookedSlots(test: Test): number {
  let count = 0;

  // Count members in each slot
  if (test.slot1?.length) count += test.slot1.length;
  if (test.slot2?.length) count += test.slot2.length;
  if (test.slot3?.length) count += test.slot3.length;
  if (test.slot4?.length) count += test.slot4.length;
  if (test.slot5?.length) count += test.slot5.length;
  if (test.slot6?.length) count += test.slot6.length;

  return Math.min(count, test.availableSlots); // Don't exceed available slots
}

/**
 * Get color for test event based on type and status
 */
function getTestEventColor(type: 'Capsize Drill' | 'Swim Test', status: 'Available' | 'Full' | 'Cancelled'): string {
  if (status === 'Cancelled') return '#ef4444'; // red-500
  if (status === 'Full') return '#6b7280'; // gray-500

  // Available tests - color by type
  switch (type) {
    case 'Swim Test':
      return '#3b82f6'; // blue-500
    case 'Capsize Drill':
      return '#f59e0b'; // amber-500
    default:
      return '#10b981'; // emerald-500
  }
}