// src/components/calendar/EventChip.tsx

"use client";

import React, { useEffect, useState } from 'react';
import { CalendarEvent } from '@/types/calendar';
import { useOutingState } from '@/hooks/useOutings';
import { formatTime } from '@/lib/date';
import ActionButton from '@/components/ui/ActionButton';

interface EventChipProps {
  event: CalendarEvent;
  onClick?: (event: CalendarEvent) => void;
  className?: string;
}

export default function EventChip({ event, onClick }: EventChipProps) {
  // Check if this is a test event
  const isTestEvent = (event as any).isTestEvent === true;
  const originalTestType = (event as any).originalTestType;
  const availableSlots = (event as any).availableSlots;

  // Prefer local outing state (assignments) if available so UI reflects immediate changes
  // Skip outing state for test events as they use different data structure
  const { assignments } = useOutingState(!isTestEvent ? (event.originalOuting || '') : '');
  // Diagnostic log: show what outing id we are subscribing to and current assignments
  // (these will appear in the browser console when the component mounts/updates).
  // Keeps minimal info to avoid leaking sensitive data in server logs.
  useEffect(() => {
    // no-op: originalOuting available for debugging when needed
  }, [event.originalOuting]);

  useEffect(() => {
    // assignments change triggers re-render via localStatus effect
  }, [assignments, event.originalOuting]);
  // Local state mirrors the effectiveStatus so we re-render reliably when assignments change.
  const [localStatus, setLocalStatus] = useState<string | undefined>(undefined);
  // Button style and text based on outing status (or test event)
  let buttonBg = undefined;
  let buttonText = 'Sign up';
  let buttonTextColor = undefined;

  // For test events, always use "Sign Up" text and don't use outing status logic
  if (isTestEvent) {
    buttonText = 'Sign Up';
    // Status styling for tests would be handled by the event status if needed
  } else {
    // Original outing logic
    // Determine effective status: prefer local OutingStatus when present.
    // Normalize to the canonical values used across the app: 'Confirmed', 'Provisional', 'Cancelled'.
    const normalizeStatus = (s: unknown): string | undefined => {
      if (s === undefined || s === null) return undefined;
      const raw = String(s).trim();
      const lower = raw.toLowerCase();
      if (lower.includes('confirm')) return 'Confirmed';
      if (lower.includes('cancel')) return 'Cancelled';
      if (lower.includes('provis') || lower === 'provisional') return 'Provisional';
      // fallback: if the input already equals one of canonical values
      if (['confirmed', 'provisional', 'cancelled', 'canceled'].includes(lower)) {
        return lower === 'canceled' ? 'Cancelled' : raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
      }
      return undefined;
    };

    const localOutingStatus = normalizeStatus(assignments?.OutingStatus);
    const propStatus = normalizeStatus(event.status);
    const effectiveStatus = localStatus ?? localOutingStatus ?? propStatus;

    useEffect(() => {
      // When assignments.OutingStatus changes, update localStatus so the chip re-renders
      setLocalStatus(localOutingStatus ?? undefined);
    }, [localOutingStatus]);

    useEffect(() => {
      // keep localStatus in sync; useful for re-rendering when assignments update
    }, [effectiveStatus, localOutingStatus, propStatus, assignments?.OutingStatus, event.originalOuting]);

    if (effectiveStatus === 'Confirmed') {
      buttonBg = '#00C53E';
      buttonText = 'Confirmed';
      buttonTextColor = '#FFFFFF';
    } else if (effectiveStatus === 'Cancelled') {
      buttonBg = '#EF4444';
      buttonText = 'Cancelled';
      buttonTextColor = '#FFFFFF';
    }
  }

  const handleSignUp = () => {
    onClick?.(event);
  };

  // Determine styling based on event type
  let isErgType = event.type === 'Erg';
  let isSwimTest = false;
  let isCapsizeDrill = false;

  // Override for test events
  if (isTestEvent) {
    isErgType = false; // Reset regular Erg styling
    isSwimTest = originalTestType === 'Swim Test';
    isCapsizeDrill = originalTestType === 'Capsize Drill';
  }

  // Determine background color
  let backgroundColor = '#FFF'; // Default white
  if (isErgType) {
    backgroundColor = '#0177FB'; // Original Erg blue
  } else if (isSwimTest) {
    backgroundColor = '#0177FB'; // Same as Erg - blue background for swim tests
  } else if (isCapsizeDrill) {
    backgroundColor = '#FFF'; // White background for capsize drills
  }

  // Determine text color
  let textColor = isErgType || isSwimTest ? '#FFFFFF' : undefined;

  // Determine event title
  let eventTitle = '';
  if (isTestEvent) {
    if (isSwimTest) {
      eventTitle = 'Swim Test';
    } else if (isCapsizeDrill) {
      eventTitle = 'Capsize Drill';
    }
  } else {
    eventTitle = `${event.division} ${event.type}`;
  }

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
        background: backgroundColor,
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
            color: textColor
          }}
          className={!textColor ? 'text-foreground' : undefined}
        >
          {eventTitle}
        </div>

        {/* Time Range */}
        <div
          style={{
            fontSize: '14px',
            color: textColor
          }}
          className={!textColor ? 'text-muted-foreground' : undefined}
        >
          {isTestEvent ? formatTime(event.startTime) : `${formatTime(event.startTime)}-${formatTime(event.endTime)}`}
        </div>

        {/* Available Slots (only for test events) */}
        {isTestEvent && availableSlots && (
          <div
            style={{
              fontSize: '14px',
              color: textColor
            }}
            className={!textColor ? 'text-muted-foreground' : undefined}
          >
            {availableSlots} Slot{availableSlots !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Sign up Button */}
      <ActionButton
        onClick={handleSignUp}
        className="w-full"
        style={{
          background: buttonBg || (isSwimTest ? '#FFFFFF' : isErgType ? '#FFFFFF' : '#E1E8FF'),
          color: buttonTextColor || (isSwimTest ? '#4C6FFF' : isErgType ? '#4C6FFF' : 'var(--Theme-Primary-Default, #4C6FFF)')
        }}
        arrowColor={buttonTextColor || '#4C6FFF'}
      >
        {buttonText}
      </ActionButton>
    </div>
  );
}