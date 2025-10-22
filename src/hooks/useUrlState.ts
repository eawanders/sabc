// src/hooks/useUrlState.ts

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import {
  parseScheduleUrl,
  buildScheduleUrl,
  parseTestUrl,
  buildTestUrl,
  ScheduleUrlState,
  FilterType,
  TestFilterType,
  parseCoxingUrl,
  buildCoxingUrl,
  CoxingUrlState
} from '@/lib/urlParams';

// Hook for schedule page URL state management
export function useScheduleUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse current URL state
  const urlState = useMemo(() => {
    // Convert searchParams to string
    const searchString = searchParams?.toString() ? `?${searchParams.toString()}` : '';
    const state = parseScheduleUrl(pathname, searchString);
    return state;
  }, [pathname, searchParams]);

  // Function to update URL with new state
  const updateUrl = useCallback((newState: Partial<ScheduleUrlState>) => {

    const searchString = searchParams?.toString() ? `?${searchParams.toString()}` : '';
    const currentState = parseScheduleUrl(pathname, searchString);

    const mergedState: ScheduleUrlState = { ...currentState, ...newState };

    const newUrl = buildScheduleUrl(mergedState);

    const currentFullUrl = pathname + searchString;

    if (newUrl !== currentFullUrl) {
      router.push(newUrl, { scroll: false });
    } else {
    }
  }, [pathname, searchParams, router]);

  // Convenience methods for common updates
  const setDate = useCallback((date: Date) => {
    try {
      updateUrl({ date });
    } catch (error) {
      console.error('🎯 useUrlState.setDate: Error in updateUrl:', error);
    }
  }, [updateUrl]);

  const setFilter = useCallback((filter: FilterType) => {
    updateUrl({ filter });
  }, [updateUrl]);

  const setMember = useCallback((memberId?: string) => {
    updateUrl({ memberId });
  }, [updateUrl]);

  const setDrawer = useCallback((drawer?: { type: 'session' | 'report' | 'test'; id: string }) => {
    updateUrl({ drawer });
  }, [updateUrl]);

  const closeDrawer = useCallback(() => {
    updateUrl({ drawer: undefined });
  }, [updateUrl]);

  const openSessionDrawer = useCallback((id: string) => {
    updateUrl({ drawer: { type: 'session', id } });
  }, [updateUrl]);

  const openReportDrawer = useCallback((id: string) => {
    updateUrl({ drawer: { type: 'report', id } });
  }, [updateUrl]);

  return {
    urlState,
    updateUrl,
    setDate,
    setFilter,
    setMember,
    setDrawer,
    closeDrawer,
    openSessionDrawer,
    openReportDrawer
  };
}

// Hook for coxing page URL state management
export function useCoxingUrlState() {
  const router = useRouter();
  const pathname = usePathname();

  const urlState = useMemo(() => parseCoxingUrl(pathname), [pathname]);

  const updateUrl = useCallback((newState: Partial<CoxingUrlState>) => {
    const currentState = parseCoxingUrl(pathname);
    const mergedState: CoxingUrlState = { ...currentState, ...newState };
    const newUrl = buildCoxingUrl(mergedState);

    if (newUrl !== pathname) {
      router.push(newUrl, { scroll: false });
    }
  }, [pathname, router]);

  const setDate = useCallback((date: Date) => {
    updateUrl({ date });
  }, [updateUrl]);

  const setMember = useCallback((memberId?: string) => {
    updateUrl({ memberId });
  }, [updateUrl]);

  return {
    urlState,
    updateUrl,
    setDate,
    setMember,
  };
}

// Hook for tests page URL state management
export function useTestsUrlState() {
  const router = useRouter();
  const pathname = usePathname();

  // Parse current URL state
  const urlState = useMemo(() => parseTestUrl(pathname), [pathname]);

  // Function to update URL with new state
  const updateUrl = useCallback((newState: Partial<{
    date: Date;
    filter: TestFilterType;
    drawer?: { type: 'test'; id: string };
  }>) => {
    const currentState = parseTestUrl(pathname);
    const mergedState = { ...currentState, ...newState };
    const newUrl = buildTestUrl(mergedState);

    if (newUrl !== pathname) {
      router.push(newUrl, { scroll: false });
    }
  }, [pathname, router]);

  // Convenience methods
  const setDate = useCallback((date: Date) => {
    updateUrl({ date });
  }, [updateUrl]);

  const setFilter = useCallback((filter: TestFilterType) => {
    updateUrl({ filter });
  }, [updateUrl]);

  const openTestDrawer = useCallback((id: string) => {
    updateUrl({ drawer: { type: 'test', id } });
  }, [updateUrl]);

  const closeDrawer = useCallback(() => {
    updateUrl({ drawer: undefined });
  }, [updateUrl]);

  return {
    urlState,
    updateUrl,
    setDate,
    setFilter,
    openTestDrawer,
    closeDrawer
  };
}

// Generic hook for any URL state management
export function useUrlNavigation() {
  const router = useRouter();

  const navigateToSchedule = useCallback((options?: {
    date?: Date;
    filter?: FilterType;
    drawer?: { type: 'session' | 'report'; id: string };
  }) => {
    const state: ScheduleUrlState = {
      date: options?.date || new Date(),
      filter: options?.filter || 'all',
      drawer: options?.drawer
    };

    const url = buildScheduleUrl(state);
    router.push(url);
  }, [router]);

  const navigateToTests = useCallback((options?: {
    date?: Date;
    filter?: TestFilterType;
    drawer?: { type: 'test'; id: string };
  }) => {
    const state = {
      date: options?.date || new Date(),
      filter: options?.filter || 'all' as TestFilterType,
      drawer: options?.drawer
    };

    const url = buildTestUrl(state);
    router.push(url);
  }, [router]);

  return {
    navigateToSchedule,
    navigateToTests
  };
}