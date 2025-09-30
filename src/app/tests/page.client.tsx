"use client";

import React, { useState, useMemo } from "react";
import { TestCalendarEvent, TestFilterType } from "@/types/test";
import { CalendarEvent } from "@/types/calendar";
import { useCalendarRange } from "@/app/(app shell)/hooks/useCalendarRange";
import TestCalendarHeader from "./TestCalendarHeader";
import CalendarWeek from "@/app/(app shell)/schedule/CalendarWeek";
import TestDrawer from "@/app/(app shell)/swim-tests/TestDrawer";
import { mapTestsToEvents, filterTestEventsByType, filterTestEventsByDateRange, groupTestEventsByDate } from "@/lib/testMappers";
import { getWeekDays, getDayNameShort, isToday } from "@/lib/date";
import MembershipSignUp from "@/components/MembershipSignUp";

const testFilterOptions = [
  { value: 'All', label: 'All Tests' },
  { value: 'Water', label: 'Swim Tests' },
  { value: 'Tank', label: 'Capsize Drills' },
];

export default function TestsPageClient() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState([]);
  const [filterType, setFilterType] = useState<TestFilterType>('All');

  // Drawer state
  const [selectedTest, setSelectedTest] = useState<{id: string; title: string; [key: string]: unknown} | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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
      const compatibleEvents = dayEvents.map((event: unknown) => {
        const testEvent = event as TestCalendarEvent & {bookedSlots?: number; testStatus?: string};
        return ({
          ...testEvent,
          type: testEvent.type === 'Swim Test' ? 'Water' as const :
                testEvent.type === 'Capsize Drill' ? 'Tank' as const : 'Other' as const,
          division: '',
          shell: undefined,
          status: 'Outing Confirmed' as const,
          sessionDetails: undefined,
          outingId: 0,
          originalOuting: testEvent.originalTest,
          // Add test-specific properties to identify this as a test event
          isTestEvent: true,
          originalTestType: testEvent.type, // Preserve original test type
          availableSlots: testEvent.availableSlots, // Preserve available slots count
          bookedSlots: testEvent.bookedSlots ?? 0, // pass through booked slots for fullness detection
          testStatus: testEvent.testStatus ?? 'Available',
        } as unknown) as CalendarEvent & { isTestEvent: boolean; originalTestType: string; availableSlots: number };
      });

      // Client-side debug: log the mapped calendar events for this day
      try {
        if (typeof window !== 'undefined') {
          console.debug('[TestsPage] mapped calendar events for', dateKey, compatibleEvents.map(e => ({
            id: e.id,
            bookedSlots: (e as CalendarEvent & {bookedSlots?: number}).bookedSlots,
            availableSlots: (e as CalendarEvent & {availableSlots?: number}).availableSlots,
            testStatus: (e as CalendarEvent & {testStatus?: string}).testStatus,
            originalTestId: (e.originalOuting as {id?: string})?.id || (e as CalendarEvent & {originalTest?: {id?: string}}).originalTest?.id
          })) );
        }
      } catch {
        // swallow
      }

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
    console.log('=== Test Event Clicked ===');
    console.log('Full event object:', event);
    console.log('event.originalOuting:', event.originalOuting);
    console.log('event.title:', event.title);
    console.log('event.type:', event.type);

    // Find the original test data
    if (event.originalOuting) {
      console.log('=== Setting Selected Test ===');
      console.log('originalOuting data:', event.originalOuting);
      console.log('originalOuting type:', typeof event.originalOuting);
      if (typeof event.originalOuting === 'object') {
        console.log('originalOuting.type:', (event.originalOuting as any).type);
      }
      setSelectedTest(event.originalOuting as any);
      setIsDrawerOpen(true);
    } else {
      console.warn('No originalOuting found in event');
    }
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedTest(null);
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

        {/* Membership Sign Up - show when there are events */}
        {!loading && stats.hasEvents && (
          <div style={{ width: '100%', paddingTop: '32px' }}>
            <MembershipSignUp />
          </div>
        )}
      </div>

      {/* Test Drawer */}
      {selectedTest && (
        <TestDrawer
          test={selectedTest as any}
          isOpen={isDrawerOpen}
          onClose={handleCloseDrawer}
        />
      )}
    </main>
  );
}
