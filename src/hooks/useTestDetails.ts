// src/hooks/useTestDetails.ts

import { useState, useEffect } from 'react';
import { Test } from '@/types/test';

export function useTestDetails(testId: string | null) {
  const [test, setTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!testId) {
      setTest(null);
      setLoading(false);
      setError(null);
      return;
    }

    async function fetchTestDetails() {
      try {
        setLoading(true);
        setError(null);

        // For now, we'll get test details from the get-tests API
        // In the future, you might want to create a specific get-test/[id] endpoint
        const response = await fetch('/api/get-tests');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch test details');
        }

        const foundTest = data.tests?.find((t: Test) => t.id === testId);
        if (!foundTest) {
          throw new Error('Test not found');
        }

        setTest(foundTest);
      } catch (err) {
        console.error('Error fetching test details:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setTest(null);
      } finally {
        setLoading(false);
      }
    }

    fetchTestDetails();
  }, [testId]);

  const refetch = () => {
    if (testId) {
      setLoading(true);
      setError(null);
    }
  };

  return {
    test,
    loading,
    error,
    refetch
  };
}