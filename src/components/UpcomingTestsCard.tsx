"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { useUpcomingTests } from '@/hooks/useUpcomingTests';
import { TestCalendarEvent } from '@/types/test';
import { formatTime, getWeekStart } from '@/lib/date';
import { buildTestUrl } from '@/lib/urlParams';

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

interface TestItemProps {
  test: TestCalendarEvent;
  onSignUp: () => void;
}

function TestItem({ test, onSignUp }: TestItemProps) {
  // Format day and time (e.g., "Wed 9:00")
  const dayName = test.startTime.toLocaleDateString('en-GB', { weekday: 'short' });
  const time = formatTime(test.startTime);
  const dayTime = `${dayName} ${time}`;

  // Determine button styling based on status
  const testStatus = test.status;

  // Determine background and text color based on test type
  const isSwimTest = test.type === 'Swim Test';
  const isCapsizeDrill = test.type === 'Capsize Drill';

  // Background color: blue for Swim Test, white for Capsize Drill
  const backgroundColor = isSwimTest ? '#0177FB' : '#FFF';

  // Text color: white for Swim Test, default for Capsize Drill
  const textColor = isSwimTest ? '#FFFFFF' : undefined;

  // Button styling based on status
  let buttonBg = undefined;
  let buttonText = 'Sign up';
  let buttonTextColor = undefined;

  if (testStatus === 'Full') {
    buttonBg = '#00C53E';
    buttonText = 'Full';
    buttonTextColor = '#FFFFFF';
  } else if (testStatus === 'Cancelled') {
    buttonBg = '#EF4444';
    buttonText = 'Cancelled';
    buttonTextColor = '#FFFFFF';
  }

  // Default button styling when no status override
  const defaultButtonBg = buttonBg || (isSwimTest ? '#FFFFFF' : '#E1E8FF');
  const defaultButtonTextColor = buttonTextColor || (isSwimTest ? '#4C6FFF' : '#4C6FFF');

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
        boxShadow: '0px 9px 44px 0px rgba(174, 174, 174, 0.20)',
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
          {test.title}
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
            e.currentTarget.style.background = '#D1DAFF';
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
          {!buttonBg && <ChevronRightIcon color={defaultButtonTextColor} />}
        </div>
      </button>
    </div>
  );
}

export default function UpcomingTestsCard() {
  const router = useRouter();
  const { tests, loading, error } = useUpcomingTests(2);

  const handleNavigate = () => {
    router.push('/tests');
  };

  const handleTestClick = (test: TestCalendarEvent) => {
    // Calculate the week start date for this test (same logic as UpcomingSessionsCard)
    const weekStart = getWeekStart(test.startTime);

    // Build URL with drawer state to open the test drawer
    const url = buildTestUrl({
      date: weekStart,
      filter: 'all',
      drawer: {
        type: 'test',
        id: test.id,
      },
    });
    router.push(url);
  };

  return (
    <div
      style={{
        display: 'flex',
        width: '300px',
        padding: '20px',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        borderRadius: '20px',
        background: '#FFF',
        boxShadow: '0 9px 44px 0 rgba(174, 174, 174, 0.20)',
              gap: '20px',
        minHeight: '300px',
      }}
    >
      {/* Header section */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '8px',
          alignSelf: 'stretch',
        }}
      >
        <h2
          className="font-bold"
          style={{
            fontSize: '22px',
          }}
        >
          Upcoming Tests
        </h2>
        <p
          className="font-light"
          style={{
            fontSize: '14px',
          }}
        >
          Sign up for OURC swim or capsize tests.
        </p>
      </div>

      {/* Test items */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '20px',
          alignSelf: 'stretch',
          flex: 1,
          justifyContent: 'center',
        }}
      >
        {loading ? (
          <p className="text-muted-foreground font-light" style={{ fontSize: '14px', textAlign: 'center', width: '100%' }}>
            Loading...
          </p>
        ) : error ? (
          <p style={{ fontSize: '14px', color: '#ff0000', textAlign: 'center', width: '100%' }}>
            {error}
          </p>
        ) : tests.length === 0 ? (
          <p className="text-muted-foreground font-light" style={{ fontSize: '14px', textAlign: 'center', width: '100%' }}>
            No upcoming tests.
          </p>
        ) : (
          tests.map((test) => (
            <TestItem
              key={test.id}
              test={test}
              onSignUp={() => handleTestClick(test)}
            />
          ))
        )}
      </div>

      {/* Navigation button */}
      <button
        onClick={handleNavigate}
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
        aria-label="Navigate to tests page"
      >
        <ChevronRightIcon color="#4C6FFF" />
      </button>
    </div>
  );
}
