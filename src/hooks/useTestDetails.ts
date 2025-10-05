// src/hooks/useTestDetails.ts

import { useEffect, useMemo, useState } from 'react';
import { Test } from '@/types/test';
import { useTestsResource } from './useTestsResource';

export function useTestDetails(testId: string | null) {
  const { tests, loading: listLoading, error: listError, refresh } = useTestsResource();
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  const [fallbackTest, setFallbackTest] = useState<Test | null>(null);

  const cachedTest = useMemo(() => {
    if (!testId) return null;
    return tests.find((test) => test.id === testId) ?? null;
  }, [tests, testId]);

  useEffect(() => {
    if (!testId) {
      setFallbackTest(null);
      setFallbackError(null);
      setFallbackLoading(false);
      return;
    }

    if (cachedTest) {
      setFallbackTest(null);
      setFallbackError(null);
      setFallbackLoading(false);
      return;
    }

    if (listLoading) {
      setFallbackLoading(true);
      return;
    }

    let cancelled = false;
    setFallbackLoading(true);
    setFallbackError(null);

    fetch(`/api/get-test?id=${testId}`)
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `Failed to fetch test ${testId}`);
        }
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        setFallbackTest((data?.test ?? null) as Test | null);
        setFallbackLoading(false);
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setFallbackError(error.message);
        setFallbackTest(null);
        setFallbackLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cachedTest, listLoading, testId]);

  const test = cachedTest ?? fallbackTest;
  const loading = listLoading || fallbackLoading;
  const error = fallbackError ?? listError;

  const refetch = () => {
    refresh();
  };

  return {
    test,
    loading,
    error,
    refetch,
  };
}
