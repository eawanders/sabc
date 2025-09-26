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
  const isTestEvent = (event as CalendarEvent & {isTestEvent?: boolean}).isTestEvent === true;
  const originalTestType = (event as CalendarEvent & {originalTestType?: string}).originalTestType;
  const availableSlots = (event as CalendarEvent & {availableSlots?: number}).availableSlots;

  // Prefer local outing state (assignments) if available so UI reflects immediate changes
  // Skip outing state for test events as they use different data structure
  const { assignments } = useOutingState(!isTestEvent ? (event.originalOuting || '') : '');

  // Local state mirrors the effectiveStatus so we re-render reliably when assignments change.
  const [localStatus, setLocalStatus] = useState<string | undefined>(undefined);

  // Normalize status function for outing events (defined at component level)
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

  // All hooks must be at top level - apply to all events but only affect non-test events
  useEffect(() => {
    // When assignments.OutingStatus changes, update localStatus so the chip re-renders
    if (!isTestEvent) {
      setLocalStatus(localOutingStatus ?? undefined);
    }
  }, [isTestEvent, localOutingStatus]);

  useEffect(() => {
    // keep localStatus in sync; useful for re-rendering when assignments update
    if (!isTestEvent) {
      // Only process for non-test events
    }
  }, [isTestEvent, effectiveStatus, localOutingStatus, propStatus, assignments?.OutingStatus, event.originalOuting]);

  // Diagnostic log: show what outing id we are subscribing to and current assignments
  // (these will appear in the browser console when the component mounts/updates).
  // Keeps minimal info to avoid leaking sensitive data in server logs.
  useEffect(() => {
    // no-op: originalOuting available for debugging when needed
  }, [event.originalOuting]);

  useEffect(() => {
    // assignments change triggers re-render via localStatus effect
  }, [assignments, event.originalOuting]);

  // Button style and text based on outing status (or test event)
  let buttonBg = undefined;
  let buttonText = 'Sign up';
  let buttonTextColor = undefined;

  // For test events, always use "Sign Up" text and don't use outing status logic
  if (isTestEvent) {
    // Determine fullness: prefer explicit event fields, otherwise infer from originalTest
    const ev = event as CalendarEvent & {bookedSlots?: number; availableSlots?: number; testStatus?: string; originalTest?: {id: string; availableSlots?: number; [key: string]: unknown}};
    const bookedSlots = typeof ev.bookedSlots === 'number' ? ev.bookedSlots : undefined;
    const avail = typeof availableSlots === 'number' ? availableSlots : (typeof ev.availableSlots === 'number' ? ev.availableSlots : 0);
    const eventStatus = ev.testStatus ?? (ev as {status?: string}).status;

    // Fallback: count filled slots from originalTest if bookedSlots is not provided
    const countFromOriginalTest = () => {
      const t = ev.originalTest;
      if (!t) return 0;
      let count = 0;
      for (let i = 1; i <= (t.availableSlots || avail || 6); i++) {
        const slotArr = (t as Record<string, unknown>)[`slot${i}`] || (t as Record<string, unknown>)[`Slot ${i}`] || (t as Record<string, unknown>)[`Slot${i}`];
        if (Array.isArray(slotArr) && slotArr.length > 0) count += slotArr.length;

        // Outcome-based fallback
        const outcome = (t as Record<string, unknown>)[`slot${i}Outcome`] || (t as Record<string, unknown>)[`Slot ${i} Outcome`] || (t as Record<string, unknown>)[`Slot${i}Outcome`];
        if (!Array.isArray(slotArr) && outcome && typeof outcome === 'string') {
          const s = outcome.toLowerCase();
          if (['test booked', 'passed', 'failed', 'rescheduled'].some(x => s.includes(x))) count++;
        }
      }
      return Math.min(count, avail || 0);
    };

    const effectiveBooked = typeof bookedSlots === 'number' ? bookedSlots : countFromOriginalTest();

    // Debug: always log key event props in the browser console so we can trace runtime values
    if (typeof window !== 'undefined') {
      try {
        console.debug('[EventChip] event props', {
          id: ev.id || (ev as {eventId?: string}).eventId || (ev.originalTest && ev.originalTest.id),
          bookedSlots: ev.bookedSlots,
          availableSlots: avail,
          effectiveBooked,
          testStatus: eventStatus,
          originalTestSummary: ev.originalTest ? { id: ev.originalTest.id, availableSlots: ev.originalTest.availableSlots } : undefined,
        });
      } catch {
        // swallow
      }
    }

    const isFull = (avail > 0 && effectiveBooked >= avail) || String(eventStatus || '').toLowerCase() === 'full';

    if (isFull) {
      buttonBg = '#00C53E';
      buttonText = 'Full';
      buttonTextColor = '#FFFFFF';
    } else {
      buttonText = 'Sign Up';
    }
    // Status styling for tests handled above
  } else {
    // Original outing logic
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
  const textColor = isErgType || isSwimTest ? '#FFFFFF' : undefined;

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