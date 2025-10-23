"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { CalendarEvent, WeekRange } from "@/types/calendar";
import { useCalendarData } from "../../hooks/useCalendarData";
import CalendarHeaderResponsive from "../CalendarHeaderResponsive";
import CalendarWeek from "../CalendarWeek";
import CalendarWeekMobile from "../CalendarWeekMobile";
import OutingDrawer from "../OutingDrawer";
import ReportDrawer from "../ReportDrawer";
import { getFlagStatus } from "../../../../lib/flagStatus";
import FlagStatusBanner from "../../../../components/FlagStatusBanner";
import MembershipSignUp from "../../../../components/MembershipSignUp";
import { FilterType } from "@/lib/urlParams";
import { useScheduleUrlState } from "@/hooks/useUrlState";
import { getWeekStart, getWeekEnd, formatWeekRange } from "@/lib/date";

// Helper function to get week number of the year
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

interface SchedulePageWithParamsProps {
  params: Promise<{ params?: string[] }>;
}

export default function SchedulePageWithParams({ params }: SchedulePageWithParamsProps) {
  const router = useRouter();
  const pathname = usePathname();

  // URL state management
  const { urlState, setDate, setFilter, setMember, openSessionDrawer, closeDrawer } = useScheduleUrlState();

  // Redirect bare /schedule to /schedule/current
  useEffect(() => {
    if (pathname === '/schedule') {
      router.replace(`/schedule/current`);
    }
  }, [pathname, router]);



  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Local state for drawer management
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [flagData, setFlagData] = useState<{ status_text?: string; notices?: string | string[]; set_date?: string } | null>(null);

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
    // Add 7 days by manipulating the date directly to avoid DST issues
    const nextWeek = new Date(currentWeekStart);
    nextWeek.setDate(nextWeek.getDate() + 7);
    // Normalize to ensure we get the correct week start
    const normalizedNextWeek = getWeekStart(nextWeek);
    setDate(normalizedNextWeek);
  }, [urlState.date, setDate]);

  const goToPreviousWeek = useCallback(() => {
    const currentWeekStart = getWeekStart(urlState.date);
    // Subtract 7 days by manipulating the date directly to avoid DST issues
    const prevWeek = new Date(currentWeekStart);
    prevWeek.setDate(prevWeek.getDate() - 7);
    // Normalize to ensure we get the correct week start
    const normalizedPrevWeek = getWeekStart(prevWeek);
    setDate(normalizedPrevWeek);
  }, [urlState.date, setDate]);

  // Convert URL filter to calendar filter format
  const calendarFilter = useMemo(() => {
    const filterMap: Record<FilterType, 'All' | 'Erg' | 'Water' | 'Tank' | 'Gym'> = {
      'all': 'All',
      'erg': 'Erg',
      'water': 'Water',
      'tank': 'Tank',
      'gym': 'Gym'
    };
    return filterMap[urlState.filter];
  }, [urlState.filter]);

  // Calendar data with URL filter and member filter
  const {
    calendarDays,
    loading,
    error,
    stats,
  } = useCalendarData(currentWeek, calendarFilter, urlState.memberId);

  // Handle drawer state from URL
  useEffect(() => {
    if (urlState.drawer && (urlState.drawer.type === 'session' || urlState.drawer.type === 'report')) {
      // Set selected event for both session and report drawers
      // The OutingDrawer will handle the report drawer internally
      setSelectedEvent({ originalOuting: urlState.drawer.id } as CalendarEvent);
    } else {
      setSelectedEvent(null);
    }
  }, [urlState.drawer]);

  // Fetch flag status on mount
  useEffect(() => {
    const fetchFlag = async () => {
      try {
        const data = await getFlagStatus();
        console.log('Fetched flag data:', data);
        setFlagData(data);
      } catch (error) {
        console.error('Failed to fetch flag status', error);
        setFlagData(null);
      }
    };
    fetchFlag();
  }, []);

  // Event handlers
  const handleEventClick = (event: CalendarEvent) => {
    openSessionDrawer(event.originalOuting);
  };

  const handleCloseDrawer = () => {
    closeDrawer();
  };

  const handleFilterChange = (type: 'All' | 'Erg' | 'Water' | 'Tank' | 'Gym') => {
    const filterMap: Record<typeof type, FilterType> = {
      'All': 'all',
      'Erg': 'erg',
      'Water': 'water',
      'Tank': 'tank',
      'Gym': 'gym'
    };

    setFilter(filterMap[type]);
  };

  const handleMemberChange = (memberId?: string) => {
    console.log('🎯 handleMemberChange called with:', memberId);
    setMember(memberId);
  };

  // Debug logging for URL state
  useEffect(() => {
    console.log('🔄 URL State updated:', {
      memberId: urlState.memberId,
      filter: urlState.filter,
      date: urlState.date,
    });
  }, [urlState]);



  // Use the same filter conversion for component props
  const componentFilterType = calendarFilter;

  if (error) {
    return (
      <main className="flex flex-col justify-center items-center gap-2.5 flex-1 px-[100px] py-[180px]">
        <h1 className="sr-only">Schedule</h1>
        <div className="text-center">
          <p className="text-destructive mb-4">Failed to load calendar data</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <main
        className="mobile-schedule-page"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '32px',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <h1 className="sr-only">Schedule</h1>
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
          <CalendarHeaderResponsive
            currentWeek={currentWeek}
            onPreviousWeek={goToPreviousWeek}
            onNextWeek={goToNextWeek}
            filterType={componentFilterType}
            onFilterChange={handleFilterChange}
            memberId={urlState.memberId}
            onMemberChange={handleMemberChange}
          />

          {/* Loading message */}
          {loading && (
            <div className="text-center py-12 flex items-center justify-center" style={{ width: '100%', minHeight: '200px' }}>
              <p className="text-muted-foreground mb-2">Loading SABC water outings, erg, gym, and tank sessions...</p>
            </div>
          )}

          {/* Calendar Grid - Mobile vs Desktop */}
          {isMobile ? (
            <CalendarWeekMobile
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
              <p className="text-muted-foreground mb-2">No outings scheduled for this week.</p>
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
      </main>

      {/* Event Details Drawer - OutingDrawer manages ReportDrawer internally */}
      {selectedEvent && (
        <OutingDrawer
          outingId={selectedEvent.originalOuting}
          isOpen={!!selectedEvent}
          onClose={handleCloseDrawer}
        />
      )}

      {/* Flag Status Banner */}
      <FlagStatusBanner
        statusText={flagData?.status_text}
        notices={flagData?.notices}
        setDate={flagData?.set_date}
      />
    </>
  );
}