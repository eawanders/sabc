"use client";

import React, { useState, useMemo } from "react";
import { TestCalendarEvent, TestFilterType } from "@/types/test";
import { CalendarEvent } from "@/types/calendar";
import { useCalendarRange } from "@/app/(app shell)/hooks/useCalendarRange";
import TestCalendarHeader from "./TestCalendarHeader";
import CalendarWeek from "@/app/(app shell)/schedule/CalendarWeek";
import { mapTestsToEvents, filterTestEventsByType, filterTestEventsByDateRange, groupTestEventsByDate } from "@/lib/testMappers";
import { getWeekDays, getDayNameShort, isToday } from "@/lib/date";

const testFilterOptions = [
  { value: 'All', label: 'All Tests' },
  { value: 'Water', label: 'Swim Tests' },
  { value: 'Tank', label: 'Capsize Drills' },
];

export default function TestsPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState([]);
  const [filterType, setFilterType] = useState<TestFilterType>('All');

  // Calendar state management
  const {
    currentWeek,
    goToNextWeek,
    goToPreviousWeek,
  } = useCalendarRange();

  // Transform tests to calendar events and filter by current week
  const weekEvents = useMemo(() => {
    if (!tests.length) return [];

    const allEvents = mapTestsToEvents(tests);
    const dateFilteredEvents = filterTestEventsByDateRange(allEvents, currentWeek.start, currentWeek.end);
    return filterTestEventsByType(dateFilteredEvents, filterType);
  }, [tests, currentWeek, filterType]);

  // Group events by date and create calendar days
  const calendarDays = useMemo(() => {
    const eventsByDate = groupTestEventsByDate(weekEvents);
    const weekDays = getWeekDays(currentWeek.start);

    return weekDays.map(date => {
      // Use local date for consistency with event grouping
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      const dayEvents = eventsByDate[dateKey] || [];

      // Convert TestCalendarEvent to CalendarEvent for compatibility
      const compatibleEvents = dayEvents.map(event => ({
        ...event,
        type: event.type === 'Swim Test' ? 'Water' as const :
              event.type === 'Capsize Drill' ? 'Tank' as const : 'Other' as const,
        division: '',
        shell: undefined,
        status: 'Outing Confirmed' as const,
        sessionDetails: undefined,
        outingId: 0,
        originalOuting: event.originalTest,
        // Add test-specific properties to identify this as a test event
        isTestEvent: true,
        originalTestType: event.type, // Preserve original test type
        availableSlots: event.availableSlots, // Preserve available slots count
      } as CalendarEvent & { isTestEvent: boolean; originalTestType: string; availableSlots: number }));

      return {
        date,
        dayName: getDayNameShort(date),
        dayNumber: date.getDate(),
        monthName: date.toLocaleDateString('en-GB', { month: 'long' }),
        isToday: isToday(date),
        events: compatibleEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
      };
    });
  }, [weekEvents, currentWeek]);

  // Stats for display
  const stats = useMemo(() => {
    return {
      totalTests: tests.length,
      weekTests: weekEvents.length,
      hasEvents: weekEvents.length > 0,
    };
  }, [tests, weekEvents]);

  // Fetch tests data automatically on mount
  React.useEffect(() => {
    const fetchTests = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/get-tests');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch tests');
        }

        setTests(data.tests || []);
      } catch (err) {
        console.error('Error fetching tests:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchTests();
  }, []);

  // Event handlers
  const handleEventClick = (event: CalendarEvent) => {
    console.log('Test clicked:', event);
    // TODO: Open test drawer when ready
  };

  const handleFilterChange = (type: 'All' | 'Erg' | 'Water' | 'Tank' | 'Gym') => {
    // Map outing filter types to test filter types
    const testFilterMap: Record<string, TestFilterType> = {
      'All': 'All',
      'Water': 'Swim test', // Map Water to Swim test
      'Tank': 'Capsize Drill', // Map Tank to Capsize Drill
      'Erg': 'All', // Default fallback
      'Gym': 'All', // Default fallback
    };
    setFilterType(testFilterMap[type] || 'All');
  };

  if (error) {
    return (
      <main className="flex flex-col justify-center items-center gap-2.5 flex-1 px-[100px] py-[180px]">
        <h1 className="sr-only">Tests</h1>
        <div className="text-center">
          <p className="text-destructive mb-4">Failed to load test data</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '32px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <h1 className="sr-only">Tests</h1>
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '32px',
          flexShrink: 1,
        }}
      >
        {/* Calendar Header with Test Filters */}
        <TestCalendarHeader
          currentWeek={currentWeek}
          onPreviousWeek={goToPreviousWeek}
          onNextWeek={goToNextWeek}
          filterType={filterType}
          onFilterChange={setFilterType}
          filterOptions={testFilterOptions}
        />        {/* Loading message */}
        {loading && (
          <div className="text-center py-12 flex items-center justify-center" style={{ width: '100%', minHeight: '200px' }}>
            <p className="text-muted-foreground mb-2">Loading OURC tests...</p>
          </div>
        )}

        {/* Calendar Grid */}
        <CalendarWeek
          calendarDays={calendarDays}
          onEventClick={handleEventClick}
          loading={loading}
        />

        {/* No events message */}
        {!loading && !stats.hasEvents && (
          <div className="text-center py-12" style={{ width: '100%' }}>
            <p className="text-muted-foreground mb-2">No tests scheduled for this week.</p>
            <p className="text-sm text-muted-foreground">
              Check back later or navigate to a different week.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
