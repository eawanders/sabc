"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Test, TestCalendarEvent, TestFilterType } from "@/types/test";
import { CalendarEvent, WeekRange } from "@/types/calendar";
import TestCalendarHeaderResponsive from "../TestCalendarHeaderResponsive";
import CalendarWeek from "@/app/(app shell)/schedule/CalendarWeek";
import TestCalendarWeekMobile from "../TestCalendarWeekMobile";
import TestDrawer from "@/app/(app shell)/swim-tests/TestDrawer";
import { mapTestsToEvents, filterTestEventsByType, filterTestEventsByDateRange, groupTestEventsByDate } from "@/lib/testMappers";
import { getWeekDays, getDayNameShort, isToday, getWeekStart, getWeekEnd, formatWeekRange } from "@/lib/date";
import MembershipSignUp from "@/components/MembershipSignUp";
import { useTestsUrlState } from "@/hooks/useUrlState";
import { TestFilterType as UrlTestFilterType } from "@/lib/urlParams";
import { useTestsResource } from "@/hooks/useTestsResource";

// Helper function to get week number of the year
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

interface TestsPageWithParamsProps {
  params: Promise<{ params?: string[] }>;
}

const testFilterOptions: { value: TestFilterType; label: string }[] = [
  { value: 'All', label: 'All Tests' },
  { value: 'Swim Test', label: 'Swim Tests' },
  { value: 'Capsize Drill', label: 'Capsize Drills' },
];

export default function TestsPageWithParams({ params }: TestsPageWithParamsProps) {
  const router = useRouter();
  const pathname = usePathname();

  // URL state management
  const { urlState, setDate, setFilter, openTestDrawer, closeDrawer } = useTestsUrlState();

  // Redirect bare /tests to /tests/current
  React.useEffect(() => {
    if (pathname === '/tests') {
      router.replace(`/tests/current`);
    }
  }, [pathname, router]);

  // Mobile detection
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { tests, loading, error } = useTestsResource();
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const handleTestUpdate = useCallback((updatedTest: Test) => {
    setSelectedTest(updatedTest);
  }, []);

  // Create currentWeek directly from URL state
  const currentWeek: WeekRange = useMemo(() => {
    const weekStart = getWeekStart(urlState.date);
    const weekEnd = getWeekEnd(urlState.date);

    return {
      start: weekStart,
      end: weekEnd,
      weekLabel: formatWeekRange(weekStart, weekEnd),
      year: weekEnd.getFullYear(),
      weekNumber: getWeekNumber(weekStart),
    };
  }, [urlState.date]);

  // Week navigation handlers using URL state
  const goToNextWeek = useCallback(() => {
    const currentWeekStart = getWeekStart(urlState.date);
    const nextWeek = new Date(currentWeekStart.getTime() + (7 * 24 * 60 * 60 * 1000));
    setDate(nextWeek);
  }, [urlState.date, setDate]);

  const goToPreviousWeek = useCallback(() => {
    const currentWeekStart = getWeekStart(urlState.date);
    const prevWeek = new Date(currentWeekStart.getTime() - (7 * 24 * 60 * 60 * 1000));
    setDate(prevWeek);
  }, [urlState.date, setDate]);

  // Convert URL filter to component filter format
  const componentFilterType = useMemo(() => {
    const filterMap: Record<UrlTestFilterType, TestFilterType> = {
      'all': 'All',
      'swim-test': 'Swim Test',
      'capsize-drill': 'Capsize Drill'
    };
    return filterMap[urlState.filter];
  }, [urlState.filter]);

  // Handle drawer state from URL
  React.useEffect(() => {
    if (urlState.drawer && urlState.drawer.type === 'test') {
      // Find the test by ID
      const test = tests.find((t) => t.id === urlState.drawer!.id);
      if (test) {
        setSelectedTest(test);
      }
    } else {
      setSelectedTest(null);
    }
  }, [urlState.drawer, tests]);

  // Transform tests to calendar events and filter by current week
  const weekEvents = useMemo(() => {

    if (!tests.length) {
      return [];
    }

    const allEvents = mapTestsToEvents(tests);

    const dateFilteredEvents = filterTestEventsByDateRange(allEvents, currentWeek.start, currentWeek.end);

    const typeFilteredEvents = filterTestEventsByType(dateFilteredEvents, componentFilterType);

    return typeFilteredEvents;
  }, [tests, currentWeek, componentFilterType]);

  // Group events by date and create calendar days
  const calendarDays = useMemo(() => {
    const eventsByDate = groupTestEventsByDate(weekEvents);

    const weekDays = getWeekDays(currentWeek.start);
    console.log('📆 [Tests Page] Week days:', weekDays.map(d => d.toDateString()));

    return weekDays.map((date) => {
      const dateKey = date.toDateString();
      const dayEvents = eventsByDate[dateKey] || [];


      // Map test events to calendar events for compatibility
      const compatibleEvents: CalendarEvent[] = dayEvents.map((event: TestCalendarEvent): CalendarEvent => {

        return {
          id: event.id,
          title: event.title,
          startTime: event.startTime,
          endTime: event.endTime,
          type: 'Water' as const, // Use Water as base type for CalendarEvent compatibility
          division: '',
          status: event.status as any,
          color: event.color,
          isPublished: true,
          outingId: 0,
          originalOuting: event.originalTest?.id || event.id,
          // Add test-specific properties for EventChip
          isTestEvent: true,
          originalTestType: event.type,
          availableSlots: event.availableSlots,
          bookedSlots: event.bookedSlots,
          originalTest: event.originalTest,
        } as any;
      });

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


  // Event handlers with URL updates
  const handleEventClick = (event: CalendarEvent) => {
    console.log('=== Test Event Clicked ===');
    console.log('Event data:', event);
    console.log('originalOuting:', event.originalOuting);
    console.log('id:', event.id);

    // For test events, get the test ID from the event
    let testId: string | undefined;

    // Try to get from originalOuting first
    if (event.originalOuting) {
      if (typeof event.originalOuting === 'string') {
        testId = event.originalOuting;
      } else if (typeof event.originalOuting === 'object' && 'id' in event.originalOuting) {
        testId = (event.originalOuting as any).id;
      }
    }

    // Fallback to event.id if originalOuting is not set
    if (!testId) {
      testId = event.id;
    }

    if (testId) {
      openTestDrawer(testId);
    } else {
    }
  };

  const handleCloseDrawer = () => {
    closeDrawer();
  };

  const handleFilterChange = (type: TestFilterType) => {
    // Map test filter types to URL test filter types
    const testFilterMap: Record<TestFilterType, UrlTestFilterType> = {
      'All': 'all',
      'Swim Test': 'swim-test',
      'Capsize Drill': 'capsize-drill',
    };
    setFilter(testFilterMap[type]);
  };

  const handleWeekNavigation = (direction: 'next' | 'prev') => {
    // Get the current week start, then add/subtract weeks properly
    const currentWeekStart = new Date(urlState.date);
    const daysToAdd = direction === 'next' ? 7 : -7;

    const newDate = new Date(currentWeekStart.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));

    setDate(newDate);
  };

  // Convert URL filter back to component format for header
  const headerFilterType = useMemo(() => {
    const filterMap: Record<UrlTestFilterType, TestFilterType> = {
      'all': 'All',
      'swim-test': 'Swim Test',
      'capsize-drill': 'Capsize Drill'
    };
    return filterMap[urlState.filter];
  }, [urlState.filter]);

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
      className="mobile-tests-page"
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
        {/* Calendar Header */}
        <TestCalendarHeaderResponsive
          currentWeek={currentWeek}
          onPreviousWeek={() => handleWeekNavigation('prev')}
          onNextWeek={() => handleWeekNavigation('next')}
          filterType={headerFilterType}
          onFilterChange={handleFilterChange}
          filterOptions={testFilterOptions}
        />

        {/* Loading message */}
        {loading && (
          <div className="text-center py-12 flex items-center justify-center" style={{ width: '100%', minHeight: '200px' }}>
            <p className="text-muted-foreground mb-2">Loading SABC swim tests and capsize drills...</p>
          </div>
        )}

        {/* Calendar Grid - Mobile vs Desktop */}
        {isMobile ? (
          <TestCalendarWeekMobile
            calendarDays={calendarDays}
            onEventClick={handleEventClick}
            loading={loading}
          />
        ) : (
          <CalendarWeek
            calendarDays={calendarDays}
            onEventClick={handleEventClick}
            loading={loading}
          />
        )}

        {/* No events message */}
        {!loading && !stats.hasEvents && (
          <div className="text-center py-12" style={{ width: '100%' }}>
            <p className="text-muted-foreground mb-2">No tests scheduled for this week.</p>
            <p className="text-sm text-muted-foreground">
              Check back later or navigate to a different week.
            </p>
          </div>
        )}

        {/* Membership Sign Up */}
        {!loading && stats.hasEvents && (
          <div style={{ width: '100%', paddingTop: '32px' }}>
            <MembershipSignUp />
          </div>
        )}
      </div>

      {/* Test Drawer */}
      {selectedTest && (
        <TestDrawer
          test={selectedTest}
          isOpen={!!selectedTest}
          onClose={handleCloseDrawer}
          onTestUpdate={handleTestUpdate}
        />
      )}
    </main>
  );
}
