// src/app/(app shell)/hooks/useCalendarRange.ts

import { useState, useCallback, useMemo } from 'react';
import { WeekRange } from '@/types/calendar';
import { getWeekStart, getWeekEnd, formatWeekRange, getCurrentWeekStart } from '@/lib/date';

/**
 * Hook for managing calendar week navigation
 * Provides current week state and navigation methods
 */
export function useCalendarRange() {
  const [currentDate, setCurrentDate] = useState<Date>(getCurrentWeekStart());

  // Calculate current week range
  const currentWeek: WeekRange = useMemo(() => {
    const weekStart = getWeekStart(currentDate);
    const weekEnd = getWeekEnd(currentDate);

    return {
      start: weekStart,
      end: weekEnd,
      weekLabel: formatWeekRange(weekStart, weekEnd),
      year: weekEnd.getFullYear(),
      weekNumber: getWeekNumber(weekStart),
    };
  }, [currentDate]);

  // Navigation methods
  const goToNextWeek = useCallback(() => {
    setCurrentDate(prev => {
      const nextWeek = new Date(prev);
      nextWeek.setDate(prev.getDate() + 7);
      return nextWeek;
    });
  }, []);

  const goToPreviousWeek = useCallback(() => {
    setCurrentDate(prev => {
      const prevWeek = new Date(prev);
      prevWeek.setDate(prev.getDate() - 7);
      return prevWeek;
    });
  }, []);

  const goToCurrentWeek = useCallback(() => {
    setCurrentDate(getCurrentWeekStart());
  }, []);

  const goToSpecificDate = useCallback((date: Date) => {
    setCurrentDate(getWeekStart(date));
  }, []);

  // Helper to check if current week is this week
  const isCurrentWeek = useMemo(() => {
    const today = new Date();
    const thisWeekStart = getWeekStart(today);
    return currentWeek.start.getTime() === thisWeekStart.getTime();
  }, [currentWeek]);

  return {
    currentWeek,
    isCurrentWeek,
    goToNextWeek,
    goToPreviousWeek,
    goToCurrentWeek,
    goToSpecificDate,
  };
}

/**
 * Helper function to get week number of the year
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
