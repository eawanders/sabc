"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { useRecentWaterOutings } from '@/hooks/useRecentWaterOutings';
import { CalendarEvent } from '@/types/calendar';
import { formatTime, getWeekStart } from '@/lib/date';
import { buildScheduleUrl } from '@/lib/urlParams';

function ChevronRightIcon({ color = '#4C6FFF' }: { color?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2.90403 1.02903C3.02607 0.90699 3.22393 0.90699 3.34597 1.02903L7.09597 4.77903C7.21801 4.90107 7.21801 5.09893 7.09597 5.22097L3.34597 8.97097C3.22393 9.09301 3.02607 9.09301 2.90403 8.97097C2.78199 8.84893 2.78199 8.65107 2.90403 8.52903L6.43306 5L2.90403 1.47097C2.78199 1.34893 2.78199 1.15107 2.90403 1.02903Z"
        fill={color}
      />
    </svg>
  );
}

interface OutingItemProps {
  event: CalendarEvent;
  onViewReport: () => void;
}

function OutingItem({ event, onViewReport }: OutingItemProps) {
  // Format day and time (e.g., "Wed 9:00")
  const dayName = event.startTime.toLocaleDateString('en-GB', { weekday: 'short' });
  const time = formatTime(event.startTime);
  const dayTime = `${dayName} ${time}`;

  // Water outings always have white background (not blue like Erg)
  const backgroundColor = '#FFF';
  const textColor = undefined; // Use default text colors

  // Report button - always active with consistent styling
  const buttonBg = '#E1E8FF';
  const buttonText = 'Report';
  const buttonTextColor = '#4C6FFF';

  return (
    <div
      style={{
        display: 'flex',
        padding: '12px',
        justifyContent: 'space-between',
        alignItems: 'center',
        alignSelf: 'stretch',
        borderRadius: '10px',
        background: backgroundColor,
        boxShadow: '0 9px 44px 0 rgba(174, 174, 174, 0.20)',
      }}
    >
      {/* Left side: Title and day/time */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <span
          style={{
            fontWeight: 'bold',
            fontSize: '14px',
            color: textColor,
          }}
          className={!textColor ? 'text-foreground' : undefined}
        >
          {`${event.division} ${event.type}`}
        </span>
        <span
          style={{
            fontSize: '14px',
            color: textColor,
          }}
          className={!textColor ? 'text-muted-foreground' : undefined}
        >
          {dayTime}
        </span>
      </div>

      {/* Right side: Report button - matching ActionButton styling */}
      <button
        onClick={onViewReport}
        style={{
          display: 'flex',
          padding: '12px 8px',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          borderRadius: '6px',
          background: buttonBg,
          border: 'none',
          cursor: 'pointer',
          transition: 'background-color 0.2s ease',
          minWidth: '90px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#D1DAFF';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = buttonBg;
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            alignSelf: 'stretch',
          }}
        >
          <span
            style={{
              fontFamily: 'Gilroy, sans-serif',
              fontSize: '12px',
              fontStyle: 'normal',
              fontWeight: 800,
              lineHeight: '12px',
              color: buttonTextColor,
            }}
          >
            {buttonText}
          </span>
          <ChevronRightIcon color={buttonTextColor} />
        </div>
      </button>
    </div>
  );
}

export default function RecentWaterOutingsCard() {
  const router = useRouter();
  const { outings, loading, error } = useRecentWaterOutings(3);

  const handleNavigateToSchedule = () => {
    router.push('/schedule');
  };

  const handleViewReport = (event: CalendarEvent) => {
    // Calculate the week start date for this event
    const weekStart = getWeekStart(event.startTime);

    // Build the URL with report drawer open
    const url = buildScheduleUrl({
      date: weekStart,
      filter: 'all',
      drawer: {
        type: 'report',
        id: event.originalOuting,
      },
    });

    router.push(url);
  };

  // Fixed height to accommodate 3 outings
  const cardMinHeight = '380px';

  return (
    <div
      style={{
        display: 'flex',
        width: '300px',
        minHeight: cardMinHeight,
        padding: '20px',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        borderRadius: '20px',
        background: '#FFF',
        boxShadow: '0 9px 44px 0 rgba(174, 174, 174, 0.20)',
        gap: '20px',
      }}
    >
      {/* Header container */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '8px',
          alignSelf: 'stretch',
        }}
      >
        <h2 className="font-bold" style={{ fontSize: '22px' }}>
          Recent Outings
        </h2>
        <p className="font-light" style={{ fontSize: '14px' }}>
          See the reports of recent water outings.
        </p>
      </div>

      {/* Central container for outing items */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '12px',
          alignSelf: 'stretch',
          flex: 1,
          justifyContent: 'center',
        }}
      >
        {loading && (
          <p className="font-light" style={{ fontSize: '12px', color: '#999' }}>
            Loading...
          </p>
        )}

        {error && (
          <p className="font-light" style={{ fontSize: '12px', color: '#ff0000' }}>
            {error}
          </p>
        )}

        {!loading && !error && outings.length === 0 && (
          <p className="font-light" style={{ fontSize: '14px', color: '#999', textAlign: 'center', width: '100%' }}>
            No recent water outings
          </p>
        )}

        {!loading && !error && outings.map((outing) => (
          <OutingItem
            key={outing.id}
            event={outing}
            onViewReport={() => handleViewReport(outing)}
          />
        ))}
      </div>

      {/* Navigation button */}
      <button
        onClick={handleNavigateToSchedule}
        style={{
          display: 'flex',
          width: '30px',
          height: '30px',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          background: '#E1E8FF',
          border: 'none',
          cursor: 'pointer',
          transition: 'background-color 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#D1DAFF';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#E1E8FF';
        }}
        aria-label="Navigate to schedule page"
      >
        <ChevronRightIcon color="#4C6FFF" />
      </button>
    </div>
  );
}
