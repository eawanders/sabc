// src/app/(app shell)/schedule/CalendarWeekMobile.tsx
"use client";

import React from 'react';
import { type CalendarDay, CalendarEvent } from '@/types/calendar';
import { formatTime } from '@/lib/date';

interface CalendarWeekMobileProps {
  calendarDays: CalendarDay[];
  onEventClick?: (event: CalendarEvent) => void;
  loading?: boolean;
}

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

interface MobileEventChipProps {
  event: CalendarEvent;
  onSignUp: () => void;
}

function MobileEventChip({ event, onSignUp }: MobileEventChipProps) {
  // Format day and time (e.g., "Wed 4, 9:00")
  const dayName = event.startTime.toLocaleDateString('en-GB', { weekday: 'short' });
  const dayNumber = event.startTime.getDate();
  const time = formatTime(event.startTime);
  const dayTime = `${dayName} ${dayNumber}, ${time}`;

  // Determine button styling based on status
  const normalizeStatus = (status: string): string => {
    const lower = status.toLowerCase();
    if (lower.includes('confirm')) return 'Confirmed';
    if (lower.includes('cancel')) return 'Cancelled';
    return 'Provisional';
  };

  const eventStatus = normalizeStatus(event.status);

  // Determine styling based on event type
  const isErgType = event.type === 'Erg';

  // Determine background color
  const backgroundColor = isErgType ? '#0177FB' : '#FFF';

  // Determine text color
  const textColor = isErgType ? '#FFFFFF' : undefined;

  // Button styling based on status
  let buttonBg = undefined;
  let buttonText = 'Sign up';
  let buttonTextColor = undefined;

  if (eventStatus === 'Confirmed') {
    buttonBg = '#00C53E';
    buttonText = 'Confirmed';
    buttonTextColor = '#FFFFFF';
  } else if (eventStatus === 'Cancelled') {
    buttonBg = '#EF4444';
    buttonText = 'Cancelled';
    buttonTextColor = '#FFFFFF';
  }

  // Default button styling when no status override
  const defaultButtonBg = buttonBg || (isErgType ? '#FFFFFF' : '#E1E8FF');
  const defaultButtonTextColor = buttonTextColor || (isErgType ? '#4C6FFF' : '#4C6FFF');

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
        width: '100%',
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

      {/* Right side: Sign up button */}
      <button
        onClick={onSignUp}
        style={{
          display: 'flex',
          padding: '12px 8px',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          borderRadius: '6px',
          background: defaultButtonBg,
          border: 'none',
          cursor: 'pointer',
          transition: 'background-color 0.2s ease',
          minWidth: '90px',
        }}
        onMouseEnter={(e) => {
          if (!buttonBg) {
            e.currentTarget.style.background = isErgType ? '#E8E8E8' : '#D1DAFF';
          }
        }}
        onMouseLeave={(e) => {
          if (!buttonBg) {
            e.currentTarget.style.background = defaultButtonBg;
          }
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
              color: defaultButtonTextColor,
            }}
          >
            {buttonText}
          </span>
          <ChevronRightIcon color={defaultButtonTextColor} />
        </div>
      </button>
    </div>
  );
}

export default function CalendarWeekMobile({ calendarDays, onEventClick, loading }: CalendarWeekMobileProps) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="animate-pulse" style={{ width: '100%' }}>
            <div className="h-16 bg-muted rounded" style={{ width: '100%' }}></div>
          </div>
        ))}
      </div>
    );
  }

  // Flatten all events from all days into a single array, sorted by time
  const allEvents: CalendarEvent[] = [];
  calendarDays.forEach(day => {
    allEvents.push(...day.events);
  });

  // Sort events by start time
  allEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        padding: '16px',
        borderRadius: '10px',
        background: 'rgba(246, 247, 249, 0.60)',
      }}
    >
      {allEvents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#848585' }}>
          No sessions this week
        </div>
      ) : (
        allEvents.map((event, index) => (
          <MobileEventChip
            key={`${event.originalOuting}-${index}`}
            event={event}
            onSignUp={() => onEventClick?.(event)}
          />
        ))
      )}
    </div>
  );
}
