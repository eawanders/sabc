// src/app/(app shell)/schedule/CalendarHeader.tsx

import React from 'react';
import { WeekRange } from '@/types/calendar';
import Button from '@/components/ui/Button';
import { LeftArrow } from '@/components/icons/LeftArrow';
import { RightArrow } from '@/components/icons/RightArrow';

interface CalendarHeaderProps {
  currentWeek: WeekRange;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
}

export default function CalendarHeader({
  currentWeek,
  onPreviousWeek,
  onNextWeek,
}: CalendarHeaderProps) {
  return (
    <div
      className="flex flex-col items-start w-full"
      style={{ gap: '16px' }}
    >
      {/* Title */}
      <h1
        className="font-semibold text-foreground"
        style={{ fontSize: '20px' }}
      >
        Outing Schedule
      </h1>

      {/* Week Display and Navigation Controls */}
      <div
        className=""
        style={{
          display: 'inline-flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px'
        }}
      >
        {/* Week Display */}
        <div className="text-lg text-muted-foreground">
          {currentWeek.weekLabel}
        </div>

        {/* Previous Week */}
        <button
          onClick={onPreviousWeek}
          className="flex items-center justify-center bg-[rgba(125,141,166,0.10)] hover:bg-[rgba(125,141,166,0.20)] transition-colors border-0"
          style={{ padding: '6px', borderRadius: '4px' }}
          aria-label="Previous week"
        >
          <LeftArrow />
        </button>

        {/* Next Week */}
        <button
          onClick={onNextWeek}
          className="flex items-center justify-center bg-[rgba(125,141,166,0.10)] hover:bg-[rgba(125,141,166,0.20)] transition-colors border-0"
          style={{ padding: '6px', borderRadius: '4px' }}
          aria-label="Next week"
        >
          <RightArrow />
        </button>
      </div>
    </div>
  );
}