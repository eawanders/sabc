// src/app/(app shell)/hooks/useCalendarData.ts

import { useMemo } from 'react';
import { CalendarEvent, WeekRange, CalendarDay, EventType } from '@/types/calendar';
import { mapOutingsToEvents, filterEventsByDateRange, filterEventsByType, filterOutingsByMember, groupEventsByDate, sortEventsByTime } from '../mappers/mapOutingsToEvents';
import { getWeekDays, getDayNameShort, isToday, isSameDay } from '@/lib/date';
import { useOutingsResource } from '@/hooks/useOutingsResource';

/**
 * Hook for fetching and managing calendar data
 * Provides events for the current week with loading and error states
 */
export function useCalendarData(
  currentWeek: WeekRange,
  filterType: EventType | 'All' = 'All',
  memberId?: string
) {
  const { outings, loading, error, refresh } = useOutingsResource();

  // Transform outings to calendar events and filter by current week
  const weekEvents: CalendarEvent[] = useMemo(() => {
    console.log('📅 useCalendarData: memberId:', memberId);
    console.log('📅 useCalendarData: filterType:', filterType);
    console.log('📅 useCalendarData: total outings:', outings.length);

    if (!outings.length) return [];

    // Filter outings by member first (before mapping to events)
    const memberFilteredOutings = filterOutingsByMember(outings, memberId);
    console.log('📅 useCalendarData: member-filtered outings:', memberFilteredOutings.length);

    const allEvents = mapOutingsToEvents(memberFilteredOutings);
    console.log('📅 useCalendarData: mapped events:', allEvents.length);

    const dateFilteredEvents = filterEventsByDateRange(allEvents, currentWeek.start, currentWeek.end);
    console.log('📅 useCalendarData: date-filtered events:', dateFilteredEvents.length);

    const finalEvents = filterEventsByType(dateFilteredEvents, filterType);
    console.log('📅 useCalendarData: final events:', finalEvents.length);

    return finalEvents;
  }, [outings, currentWeek, filterType, memberId]);

  // Group events by date and create calendar days
  const calendarDays: CalendarDay[] = useMemo(() => {
    const eventsByDate = groupEventsByDate(weekEvents);
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
        events: sortEventsByTime(dayEvents),
      };
    });
  }, [weekEvents, currentWeek]);

  // Helper to find events for a specific date
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    return weekEvents.filter(event => isSameDay(event.startTime, date));
  };

  // Statistics
  const stats = useMemo(() => {
    const totalEvents = weekEvents.length;
    const eventsByType = weekEvents.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalEvents,
      eventsByType,
      hasEvents: totalEvents > 0,
    };
  }, [weekEvents]);

  return {
    calendarDays,
    weekEvents,
    loading,
    error,
    stats,
    getEventsForDate,
    // Helper for debugging
    rawOutings: outings,
    refresh,
  };
}
