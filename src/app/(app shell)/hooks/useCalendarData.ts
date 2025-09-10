// src/app/(app shell)/hooks/useCalendarData.ts

import { useState, useEffect, useMemo } from 'react';
import { CalendarEvent, WeekRange, CalendarDay, EventType } from '@/types/calendar';
import { Outing } from '@/types/outing';
import { mapOutingsToEvents, filterEventsByDateRange, filterEventsByType, groupEventsByDate, sortEventsByTime } from '../mappers/mapOutingsToEvents';
import { getWeekDays, getDayNameShort, isToday, isSameDay } from '@/lib/date';

/**
 * Hook for fetching and managing calendar data
 * Provides events for the current week with loading and error states
 */
export function useCalendarData(currentWeek: WeekRange, filterType: EventType | 'All' = 'All') {
  const [outings, setOutings] = useState<Outing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch outings data
  useEffect(() => {
    async function fetchOutings() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/get-outings');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch outings');
        }

        setOutings(data.outings || []);
      } catch (err) {
        console.error('Error fetching outings:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchOutings();
  }, []); // Only fetch once, not dependent on currentWeek

  // Transform outings to calendar events and filter by current week
  const weekEvents: CalendarEvent[] = useMemo(() => {
    if (!outings.length) return [];

    const allEvents = mapOutingsToEvents(outings);
    const dateFilteredEvents = filterEventsByDateRange(allEvents, currentWeek.start, currentWeek.end);
    return filterEventsByType(dateFilteredEvents, filterType);
  }, [outings, currentWeek, filterType]);

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
  };
}
