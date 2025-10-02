// src/hooks/useUpcomingTests.ts

import { useState, useEffect, useMemo } from 'react';
import { Test, TestCalendarEvent } from '@/types/test';
import { mapTestsToEvents } from '@/lib/testMappers';

/**
 * Hook for fetching upcoming tests
 * Returns the next 3 tests that haven't ended yet
 */
export function useUpcomingTests() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch tests data
  useEffect(() => {
    async function fetchTests() {
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
    }

    fetchTests();
  }, []);

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
