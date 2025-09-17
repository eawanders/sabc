// src/app/(app shell)/schedule/CalendarWeek.tsx

import React from 'react';
import { type CalendarDay, CalendarEvent } from '@/types/calendar';
import EventChip from '@/components/calendar/EventChip';
import { cn } from '@/lib/classnames';

interface CalendarWeekProps {
  calendarDays: CalendarDay[];
  onEventClick?: (event: CalendarEvent) => void;
  loading?: boolean;
}

export default function CalendarWeek({ calendarDays, onEventClick, loading }: CalendarWeekProps) {
  if (loading) {
    return (
  <div className="grid grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="animate-pulse">
            <div className="h-6 bg-muted rounded mb-3"></div>
            <div className="space-y-2">
              <div className="h-16 bg-muted rounded"></div>
              <div className="h-12 bg-muted rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-7 gap-4 justify-center items-center"
      style={{
        display: 'flex',
        padding: '32px',
        alignItems: 'flex-start',
        gap: '24px',
        borderRadius: '10px',
        background: 'rgba(246, 247, 249, 0.60)',
        minHeight: '273px'
      }}
    >
      {calendarDays.map((day) => (
        <CalendarDay
          key={day.date.toISOString()}
          day={day}
          onEventClick={onEventClick}
        />
      ))}
    </div>
  );
}

interface CalendarDayProps {
  day: CalendarDay;
  onEventClick?: (event: CalendarEvent) => void;
}

function CalendarDay({ day, onEventClick }: CalendarDayProps) {
  return (
    <div
      style={{
        display: 'flex',
        width: '110px',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px'
      }}
    >
      {/* Day Header */}
      <div
        className="text-center"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}
      >
        <div className="text-sm font-medium text-muted-foreground">
          {day.dayName}
        </div>
        <div className={cn(
          'text-lg font-semibold',
          day.isToday
            ? 'text-primary'
            : 'text-foreground'
        )}>
          {day.dayNumber.toString().padStart(2, '0')}
        </div>
      </div>

      {/* Events */}
      <div
        className="flex flex-col items-center"
        style={{ gap: '12px' }}
      >
        {day.events.map((event) => (
          <EventChip
            key={event.id}
            event={event}
            onClick={onEventClick}
          />
        ))}
      </div>
    </div>
  );
}