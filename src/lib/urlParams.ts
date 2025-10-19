// src/lib/urlParams.ts

import { getWeekStart } from '@/lib/date';

// Types for URL state management
export interface ScheduleUrlState {
  date: Date;           // Week start date
  filter: FilterType;   // Outing type filter
  memberId?: string;    // Optional member filter
  drawer?: DrawerState; // Optional drawer state
}

export interface DrawerState {
  type: 'session' | 'report' | 'test';
  id: string;
}

export interface CoxingUrlState {
  date: Date;
  memberId?: string;
}

export type FilterType = 'all' | 'water' | 'erg' | 'tank' | 'gym';
export type TestFilterType = 'all' | 'swim-test' | 'capsize-drill';

// URL parameter parsing and building utilities

/**
 * Parse URL pathname into schedule state
 * Examples:
 * /schedule → { date: currentWeek, filter: 'all' }
 * /schedule/2025-01-15 → { date: 2025-01-15 week, filter: 'all' }
 * /schedule/2025-01-15/water → { date: ..., filter: 'water' }
 * /schedule/2025-01-15/water/session/abc123 → { date: ..., filter: 'water', drawer: {type: 'session', id: 'abc123'} }
 * /schedule/2025-01-15/water/report/abc123 → { date: ..., filter: 'water', drawer: {type: 'report', id: 'abc123'} }
 * /schedule/2025-01-15?member=abc123 → { date: ..., filter: 'all', memberId: 'abc123' }
 */
export function parseScheduleUrl(pathname: string, searchParams?: string): ScheduleUrlState {
  // Remove leading slash and split by '/'
  const segments = pathname.replace(/^\//, '').split('/').filter(Boolean);

  // Default state
  const defaultState: ScheduleUrlState = {
    date: getWeekStart(new Date()),
    filter: 'all'
  };

  // Handle base case: /schedule
  if (segments.length === 0 || segments[0] !== 'schedule') {
    return defaultState;
  }

  // Parse query parameters for memberId
  if (searchParams) {
    const params = new URLSearchParams(searchParams);
    const memberParam = params.get('member');
    if (memberParam) {
      defaultState.memberId = memberParam;
    }
  }

  // Parse date segment (index 1)
  if (segments[1]) {
    const dateSegment = segments[1];

    // Handle special date aliases
    if (dateSegment === 'current') {
      defaultState.date = getWeekStart(new Date());
    } else if (dateSegment === 'next') {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      defaultState.date = getWeekStart(nextWeek);
    } else if (dateSegment === 'prev') {
      const prevWeek = new Date();
      prevWeek.setDate(prevWeek.getDate() - 7);
      defaultState.date = getWeekStart(prevWeek);
    } else {
      // Try to parse as ISO date
      try {
        const parsed = new Date(dateSegment);
        if (!isNaN(parsed.getTime())) {
          defaultState.date = getWeekStart(parsed);
        }
      } catch {
        // Invalid date, use default
      }
    }
  }

  // Parse filter segment (index 2)
  if (segments[2]) {
    const filterSegment = segments[2];
    if (['all', 'water', 'erg', 'tank', 'gym'].includes(filterSegment)) {
      defaultState.filter = filterSegment as FilterType;
    }
  }

  // Parse drawer segments (index 3 and 4)
  if (segments[3] && segments[4]) {
    const drawerType = segments[3];
    const drawerId = segments[4];

    if (isValidDrawerType(drawerType)) {
      defaultState.drawer = {
        type: drawerType,
        id: drawerId
      };
    }
  }

  return defaultState;
}

/**
 * Parse URL pathname into test page state
 * Examples:
 * /tests → { date: currentWeek, filter: 'all' }
 * /tests/2025-01-15/swim-test/test-123 → { date: ..., filter: 'swim-test', drawer: {...} }
 */
export function parseTestUrl(pathname: string): {
  date: Date;
  filter: TestFilterType;
  drawer?: DrawerState;
} {
  const segments = pathname.replace(/^\//, '').split('/').filter(Boolean);

  const defaultState: {
    date: Date;
    filter: TestFilterType;
    drawer?: DrawerState;
  } = {
    date: getWeekStart(new Date()),
    filter: 'all' as TestFilterType
  };

  if (segments.length === 0 || segments[0] !== 'tests') {
    return defaultState;
  }

  // Parse similar to schedule but with test-specific filters
  if (segments[1]) {
    const dateSegment = segments[1];

    if (dateSegment === 'current') {
      defaultState.date = getWeekStart(new Date());
    } else if (dateSegment === 'next') {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      defaultState.date = getWeekStart(nextWeek);
    } else if (dateSegment === 'prev') {
      const prevWeek = new Date();
      prevWeek.setDate(prevWeek.getDate() - 7);
      defaultState.date = getWeekStart(prevWeek);
    } else {
      try {
        const parsed = new Date(dateSegment);
        if (!isNaN(parsed.getTime())) {
          defaultState.date = getWeekStart(parsed);
        }
      } catch {
        // Invalid date, use default
      }
    }
  }

  if (segments[2]) {
    const filterSegment = segments[2];
    if (['all', 'swim-test', 'capsize-drill'].includes(filterSegment)) {
      defaultState.filter = filterSegment as TestFilterType;
    }
  }

  // Test drawer parsing
  if (segments[2] && segments[3]) {
    // For tests, the structure might be /tests/date/filter/test-id
    // where filter could be 'all', 'swim-test', or 'capsize-drill'
    const filterSegment = segments[2];
    const testId = segments[3];

    if (['all', 'swim-test', 'capsize-drill'].includes(filterSegment)) {
      defaultState.filter = filterSegment as TestFilterType;
      defaultState.drawer = {
        type: 'test',
        id: testId
      };
    }
  }

  return defaultState;
}

/**
 * Build URL pathname from schedule state
 */
export function buildScheduleUrl(state: ScheduleUrlState): string {
  const segments = ['schedule'];

  const dateAlias = getDateAlias(state.date);
  segments.push(dateAlias ?? formatDateForUrl(state.date));

  // Add filter segment (only if not 'all' or if drawer is present)
  if (state.filter !== 'all' || state.drawer) {
    segments.push(state.filter);
  }

  // Add drawer segments
  if (state.drawer) {
    segments.push(state.drawer.type, state.drawer.id);
  }

  let url = '/' + segments.join('/');

  // Add memberId as query parameter if present
  if (state.memberId) {
    url += `?member=${encodeURIComponent(state.memberId)}`;
  }

  return url;
}

/**
 * Build URL pathname from test state
 */
export function buildTestUrl(state: {
  date: Date;
  filter: TestFilterType;
  drawer?: DrawerState;
}): string {
  const segments = ['tests'];

  const dateAlias = getDateAlias(state.date);
  segments.push(dateAlias ?? formatDateForUrl(state.date));

  // For tests, always add filter if not 'all' or if drawer present
  if (state.filter !== 'all' || state.drawer) {
    segments.push(state.filter);
  }

  // Add drawer (test ID)
  if (state.drawer) {
    segments.push(state.drawer.id);
  }

  return '/' + segments.join('/');
}

/**
 * Parse URL pathname into coxing page state
 * Examples:
 * /coxing → { date: currentWeek, memberId: undefined }
 * /coxing/current/member/abc123 → { date: currentWeek, memberId: 'abc123' }
 * /coxing/2025-01-15/member/abc123 → { date: 2025-01-15 week, memberId: 'abc123' }
 */
export function parseCoxingUrl(pathname: string): CoxingUrlState {
  const segments = pathname.replace(/^\//, '').split('/').filter(Boolean);

  const defaultState: CoxingUrlState = {
    date: getWeekStart(new Date()),
  };

  if (segments.length === 0 || segments[0] !== 'coxing') {
    return defaultState;
  }

  // Date segment
  if (segments[1]) {
    const dateSegment = segments[1];

    if (dateSegment === 'current') {
      defaultState.date = getWeekStart(new Date());
    } else if (dateSegment === 'next') {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      defaultState.date = getWeekStart(nextWeek);
    } else if (dateSegment === 'prev') {
      const prevWeek = new Date();
      prevWeek.setDate(prevWeek.getDate() - 7);
      defaultState.date = getWeekStart(prevWeek);
    } else {
      try {
        const parsed = new Date(dateSegment);
        if (!isNaN(parsed.getTime())) {
          defaultState.date = getWeekStart(parsed);
        }
      } catch {
        // keep default
      }
    }
  }

  // Member segment: /coxing/<date>/member/<id>
  if (segments[2] === 'member' && segments[3]) {
    defaultState.memberId = segments[3];
  }

  return defaultState;
}

/**
 * Build URL pathname from coxing state
 */
export function buildCoxingUrl(state: CoxingUrlState): string {
  const segments = ['coxing'];

  const dateAlias = getDateAlias(state.date);
  const dateSegment = dateAlias ?? formatDateForUrl(state.date);
  segments.push(dateSegment);

  if (state.memberId) {
    segments.push('member', state.memberId);
  }

  return '/' + segments.join('/');
}

/**
 * Format date for URL (YYYY-MM-DD format)
 */
export function formatDateForUrl(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse date from URL segment
 */
export function parseDateFromUrl(dateSegment: string): Date {
  if (dateSegment === 'current') {
    return getWeekStart(new Date());
  } else if (dateSegment === 'next') {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return getWeekStart(nextWeek);
  } else if (dateSegment === 'prev') {
    const prevWeek = new Date();
    prevWeek.setDate(prevWeek.getDate() - 7);
    return getWeekStart(prevWeek);
  } else {
    try {
      const parsed = new Date(dateSegment);
      if (!isNaN(parsed.getTime())) {
        return getWeekStart(parsed);
      }
    } catch {
      // Fall through to default
    }
  }

  // Default to current week
  return getWeekStart(new Date());
}

/**
 * Check if two dates represent the same week
 */
export function isSameWeek(date1: Date, date2: Date): boolean {
  const week1Start = getWeekStart(date1);
  const week2Start = getWeekStart(date2);
  return week1Start.getTime() === week2Start.getTime();
}

/**
 * Get the appropriate date alias for URL if applicable
 */
export function getDateAlias(date: Date): string | null {
  const today = new Date();

  if (isSameWeek(date, today)) {
    return 'current';
  }

  return null; // Use full date
}

/**
 * Validate filter type for schedule
 */
export function isValidScheduleFilter(filter: string): filter is FilterType {
  return ['all', 'water', 'erg', 'tank', 'gym'].includes(filter);
}

/**
 * Validate filter type for tests
 */
export function isValidTestFilter(filter: string): filter is TestFilterType {
  return ['all', 'swim-test', 'capsize-drill'].includes(filter);
}

/**
 * Validate drawer type
 */
export function isValidDrawerType(type: string): type is 'session' | 'report' | 'test' {
  return ['session', 'report', 'test'].includes(type);
}