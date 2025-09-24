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
  // Prefer local outing state (assignments) if available so UI reflects immediate changes
  const { assignments } = useOutingState(event.originalOuting || '');
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
  // Button style and text based on outing status
  let buttonBg = undefined;
  let buttonText = 'Sign up';
  let buttonTextColor = undefined;
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