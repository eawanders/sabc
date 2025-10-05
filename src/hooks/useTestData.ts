// src/hooks/useTestData.ts

import { useMemo } from 'react';
import { TestCalendarEvent, TestFilterType } from '@/types/test';
import { WeekRange } from '@/types/calendar';
import { mapTestsToEvents, filterTestEventsByDateRange, filterTestEventsByType, groupTestEventsByDate, sortTestEventsByTime } from '@/lib/testMappers';
import { getWeekDays, getDayNameShort, isToday } from '@/lib/date';
import { useTestsResource } from './useTestsResource';

// Define a CalendarDay interface for tests
export interface TestCalendarDay {
  date: Date;
  dayName: string;
  dayNumber: number;
  monthName: string;
  isToday: boolean;
  events: TestCalendarEvent[];
}

/**
 * Hook for fetching and managing test data
 * Provides test events for the current week with loading and error states
 */
export function useTestData(currentWeek: WeekRange, filterType: TestFilterType = 'All') {
  const { tests, loading, error, refresh } = useTestsResource();

  // Transform tests to calendar events and filter by current week
  const weekEvents: TestCalendarEvent[] = useMemo(() => {
    if (!tests.length) return [];

    const allEvents = mapTestsToEvents(tests);
    const dateFilteredEvents = filterTestEventsByDateRange(allEvents, currentWeek.start, currentWeek.end);
    return filterTestEventsByType(dateFilteredEvents, filterType);
  }, [tests, currentWeek, filterType]);

  // Group events by date and create calendar days
  const calendarDays: TestCalendarDay[] = useMemo(() => {
    const eventsByDate = groupTestEventsByDate(weekEvents);
    const weekDays = getWeekDays(currentWeek.start);

    return weekDays.map(date => {
      // Use local date for consistency with event grouping
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      const dayEvents = eventsByDate[dateKey] || [];

      return {
        date,
        dayName: getDayNameShort(date),
        dayNumber: date.getDate(),
        monthName: date.toLocaleDateString('en-GB', { month: 'long' }),
        isToday: isToday(date),
        events: sortTestEventsByTime(dayEvents),
      };
    });
  }, [weekEvents, currentWeek]);

  // Stats and helper functions
  const stats = useMemo(() => {
    return {
      totalTests: tests.length,
      weekTests: weekEvents.length,
      hasEvents: weekEvents.length > 0,
      availableSlots: weekEvents.reduce((sum, event) => sum + (event.availableSlots - event.bookedSlots), 0),
      bookedSlots: weekEvents.reduce((sum, event) => sum + event.bookedSlots, 0),
    };
  }, [tests, weekEvents]);

  return {
    tests,
    weekEvents,
    calendarDays,
    loading,
    error,
    stats,
    refetch: refresh,
  };
}
