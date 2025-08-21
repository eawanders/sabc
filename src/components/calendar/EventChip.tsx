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
  // Button style and text based on outing status
  let buttonBg = undefined;
  let buttonText = 'Sign up';
  let buttonTextColor = undefined;
  if (event.status === 'Outing Confirmed') {
    buttonBg = '#00C53E';
    buttonText = 'Confirmed';
    buttonTextColor = '#FFFFFF';
  } else if (event.status === 'Outing Cancelled') {
    buttonBg = '#EF4444';
    buttonText = 'Cancelled';
    buttonTextColor = '#FFFFFF';
  }
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
      <ActionButton
        onClick={handleSignUp}
        className="w-full"
        style={{ background: buttonBg || (isErgType ? '#FFFFFF' : '#E1E8FF'), color: buttonTextColor || (isErgType ? '#4C6FFF' : 'var(--Theme-Primary-Default, #4C6FFF)') }}
        arrowColor={buttonTextColor || '#4C6FFF'}
      >
        {buttonText}
      </ActionButton>
    </div>
  );
}