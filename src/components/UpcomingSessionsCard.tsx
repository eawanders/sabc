"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { useUpcomingSessions } from '@/hooks/useUpcomingSessions';
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

interface SessionItemProps {
  event: CalendarEvent;
  onSignUp: () => void;
}

function SessionItem({ event, onSignUp }: SessionItemProps) {
  // Format day and time (e.g., "Wed 9:00")
  const dayName = event.startTime.toLocaleDateString('en-GB', { weekday: 'short' });
  const time = formatTime(event.startTime);
  const dayTime = `${dayName} ${time}`;

  // Determine button styling based on status
  const normalizeStatus = (status: string): string => {
    const lower = status.toLowerCase();
    if (lower.includes('confirm')) return 'Confirmed';
    if (lower.includes('cancel')) return 'Cancelled';
    return 'Provisional';
  };

  const eventStatus = normalizeStatus(event.status);

  // Determine styling based on event type (matching EventChip logic)
  const isErgType = event.type === 'Erg';

  // Determine background color
  const backgroundColor = isErgType ? '#0177FB' : '#FFF'; // Blue for Erg, white for others

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

  // Default button styling when no status override (matching EventChip)
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
        boxShadow: '0 9px 44px 0 rgba(174, 174, 174, 0.20)', // Added shadow to match EventChip
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

      {/* Right side: Sign up button - matching ActionButton styling */}
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

export default function UpcomingSessionsCard() {
  const router = useRouter();
  const { sessions, loading, error } = useUpcomingSessions(2);

  const handleNavigateToSchedule = () => {
    router.push('/schedule');
  };

  const handleSignUp = (event: CalendarEvent) => {
    // Calculate the week start date for this event
    const weekStart = getWeekStart(event.startTime);

    // Build the URL with drawer open
    const url = buildScheduleUrl({
      date: weekStart,
      filter: 'all',
      drawer: {
        type: 'session',
        id: event.originalOuting,
      },
    });

    router.push(url);
  };

  // Fixed height to accommodate 3 sessions
  const cardMinHeight = '380px';

  return (
    <div
      style={{
        display: 'flex',
        width: '300px',
        height: '300px',
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
          Upcoming Sessions
        </h2>
        <p className="font-light" style={{ fontSize: '14px' }}>
          Water, erg, gym, and tank sessions.
        </p>
      </div>

      {/* Central container for session items */}
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
          <p className="text-muted-foreground font-light" style={{ fontSize: '14px', textAlign: 'center', width: '100%' }}>
            Loading...
          </p>
        )}

        {error && (
          <p style={{ fontSize: '14px', color: '#ff0000', textAlign: 'center', width: '100%' }}>
            {error}
          </p>
        )}

        {!loading && !error && sessions.length === 0 && (
          <p className="text-muted-foreground font-light" style={{ fontSize: '14px', textAlign: 'center', width: '100%' }}>
            No upcoming sessions
          </p>
        )}

        {!loading && !error && sessions.map((session) => (
          <SessionItem
            key={session.id}
            event={session}
            onSignUp={() => handleSignUp(session)}
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
