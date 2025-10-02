"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { useNextEvent } from '@/hooks/useNextEvent';

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

export default function NextEventCard() {
  const router = useRouter();
  const { event, loading, error } = useNextEvent();

  const handleNavigate = () => {
    router.push('/events');
  };

  // Blue color for labels (matching the theme primary color)
  const labelColor = '#4C6FFF';

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
          Next Event
        </h2>
        <p className="font-light" style={{ fontSize: '14px' }}>
          See the upcoming events held by SABC.
        </p>
      </div>

      {/* Central container for event details */}
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

        {!loading && !error && !event && (
          <p className="text-muted-foreground font-light" style={{ fontSize: '14px', textAlign: 'center', width: '100%' }}>
            No upcoming events
          </p>
        )}

        {!loading && !error && event && (
          <>
            {/* Event Title */}
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontFamily: 'Gilroy, sans-serif',
                  fontWeight: 800,
                  fontSize: '14px',
                  color: labelColor,
                }}
              >
                Event:
              </span>
              <span
                className="font-light"
                style={{
                  fontSize: '14px',
                  color: '#000',
                }}
              >
                {event.title}
              </span>
            </div>

            {/* Event Date */}
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontFamily: 'Gilroy, sans-serif',
                  fontWeight: 800,
                  fontSize: '14px',
                  color: labelColor,
                }}
              >
                Date:
              </span>
              <span
                className="font-light"
                style={{
                  fontSize: '14px',
                  color: '#000',
                }}
              >
                {event.date}
              </span>
            </div>
          </>
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
        aria-label="Navigate to events page"
      >
        <ChevronRightIcon color="#4C6FFF" />
      </button>
    </div>
  );
}
