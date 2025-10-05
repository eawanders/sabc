// src/hooks/useUpcomingTests.ts

import { useMemo } from 'react';
import { TestCalendarEvent } from '@/types/test';
import { mapTestsToEvents } from '@/lib/testMappers';
import { useTestsResource } from './useTestsResource';

/**
 * Hook for fetching upcoming tests
 * Returns the next 3 tests that haven't ended yet
 */
export function useUpcomingTests() {
  const { tests, loading, error } = useTestsResource();

  // Get upcoming tests (next 3 that haven't ended yet)
  const upcomingTests: TestCalendarEvent[] = useMemo(() => {
    if (!tests.length) return [];

    const now = new Date();
    const allEvents = mapTestsToEvents(tests);

    // Filter for tests that haven't ended yet
    const futureTests = allEvents.filter(event => event.endTime >= now);

    // Sort by start time ascending
    futureTests.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    // Return first 3
    return futureTests.slice(0, 3);
  }, [tests]);

  return {
    tests: upcomingTests,
    loading,
    error,
  };
}
