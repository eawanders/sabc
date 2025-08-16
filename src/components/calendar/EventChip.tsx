// src/components/calendar/EventChip.tsx

import React from 'react';
import { CalendarEvent } from '@/types/calendar';
import { formatTime } from '@/lib/date';
import ActionButton from '@/components/ui/ActionButton';

interface EventChipProps {
  event: CalendarEvent;
  onClick?: (event: CalendarEvent) => void;
  className?: string;
}

export default function EventChip({ event, onClick }: EventChipProps) {
    const handleSignUp = () => {
    onClick?.(event);
  };

  // Determine if this is an Erg type event
  const isErgType = event.type === 'Erg';

  return (
    <div
      style={{
        display: 'flex',
        padding: '12px',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        alignSelf: 'stretch',
        minWidth: '110px',
        minHeight: '140px',
        borderRadius: '10px',
        background: isErgType ? '#0177FB' : '#FFF',
        boxShadow: '0 9px 44px 0 rgba(174, 174, 174, 0.20)'
      }}
    >
      {/* Header with Division and Type */}
      <div
        className="w-full"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}
      >
        <div
          style={{
            fontWeight: 'bold',
            fontSize: '14px',
            color: isErgType ? '#FFFFFF' : undefined
          }}
          className={!isErgType ? 'text-foreground' : undefined}
        >
          {event.division} {event.type}
        </div>

        {/* Time Range */}
        <div
          style={{
            fontSize: '14px',
            color: isErgType ? '#FFFFFF' : undefined
          }}
          className={!isErgType ? 'text-muted-foreground' : undefined}
        >
          {formatTime(event.startTime)}-{formatTime(event.endTime)}
        </div>
      </div>

      {/* Sign up Button */}
      {isErgType ? (
        <button
          onClick={handleSignUp}
          className="w-full transition-all duration-200 hover:bg-gray-100"
          style={{
            display: 'flex',
            padding: '12px 8px',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
            alignSelf: 'stretch',
            borderRadius: '6px',
            border: '1px solid #FFF',
            background: '#FFFFFF',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#F3F4F6';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#FFFFFF';
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            alignSelf: 'stretch'
          }}>
            <span style={{
              color: '#4C6FFF',
              fontFamily: 'Gilroy',
              fontSize: '12px',
              fontWeight: 800,
              lineHeight: '12px'
            }}>
              Sign up
            </span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M2.90403 1.02903C3.02607 0.90699 3.22393 0.90699 3.34597 1.02903L7.09597 4.77903C7.21801 4.90107 7.21801 5.09893 7.09597 5.22097L3.34597 8.97097C3.22393 9.09301 3.02607 9.09301 2.90403 8.97097C2.78199 8.84893 2.78199 8.65107 2.90403 8.52903L6.43306 5L2.90403 1.47097C2.78199 1.34893 2.78199 1.15107 2.90403 1.02903Z"
                fill="#4C6FFF"
              />
            </svg>
          </div>
        </button>
      ) : (
        <ActionButton onClick={handleSignUp} className="w-full">
          Sign up
        </ActionButton>
      )}
    </div>
  );
}