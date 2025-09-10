// src/app/(app shell)/schedule/CalendarHeader.tsx

import React from 'react';
import { WeekRange } from '@/types/calendar';
import { LeftArrow } from '@/components/icons/LeftArrow';
import { RightArrow } from '@/components/icons/RightArrow';
import Select, { components, DropdownIndicatorProps, GroupBase } from 'react-select';

// Custom DropdownIndicator for react-select with thinner arrow
const DropdownIndicator = (
  props: DropdownIndicatorProps<
    { value: string; label: string },
    false,
    GroupBase<{ value: string; label: string }>
  >
) => (
  <components.DropdownIndicator {...props}>
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 8L10 12L14 8" stroke="#7D8DA6" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </components.DropdownIndicator>
);

const filterOptions = [
  { value: 'All', label: 'All Sessions' },
  { value: 'Water', label: 'Water Outing' },
  { value: 'Tank', label: 'Tank Session' },
  { value: 'Erg', label: 'Erg Session' },
  { value: 'Gym', label: 'Gym Session' },
];

interface CalendarHeaderProps {
  currentWeek: WeekRange;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  filterType: 'All' | 'Erg' | 'Water' | 'Tank' | 'Gym';
  onFilterChange: (type: 'All' | 'Erg' | 'Water' | 'Tank' | 'Gym') => void;
}

export default function CalendarHeader({
  currentWeek,
  onPreviousWeek,
  onNextWeek,
  filterType,
  onFilterChange,
}: CalendarHeaderProps) {
  return (
    <div
      className="flex flex-col items-start w-full"
      style={{ gap: '16px' }}
    >
      {/* Title and Filter Row */}
      <div className="flex items-center justify-between w-full">
        <h1 className="text-3xl font-bold">Outing Schedule</h1>

        {/* Filter Dropdown */}
        <div style={{ width: '200px' }}>
          <Select
            components={{ DropdownIndicator }}
        /* Provide a deterministic instanceId so the server-rendered aria-live id
          matches the client during hydration. This prevents the "react-hydration-error"
          caused by react-select's internal incremental id generation. */
        instanceId="calendar-filter"
            options={filterOptions}
            value={filterOptions.find(option => option.value === filterType)}
            onChange={(option) => option && onFilterChange(option.value as 'All' | 'Erg' | 'Water' | 'Tank' | 'Gym')}
            styles={{
              control: (base) => ({
                ...base,
                backgroundColor: '#FFF',
                border: '1px solid #E5E7EB',
                borderRadius: '6px',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                minHeight: '40px',
                fontSize: '14px',
                fontFamily: 'Gilroy',
              }),
              option: (base, state) => ({
                ...base,
                backgroundColor: state.isSelected ? '#F3F4F6' : state.isFocused ? '#F9FAFB' : 'white',
                color: '#374151',
                fontSize: '14px',
                fontFamily: 'Gilroy',
                cursor: 'pointer',
              }),
              singleValue: (base) => ({
                ...base,
                color: '#374151',
                fontSize: '14px',
                fontFamily: 'Gilroy',
              }),
            }}
            placeholder="Filter by type"
          />
        </div>
      </div>


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
          style={{ padding: '6px', borderRadius: '4px', cursor: 'pointer' }}
          aria-label="Previous week"
          data-calendar-arrow
        >
          <LeftArrow />
        </button>

        {/* Next Week */}
        <button
          onClick={onNextWeek}
          className="flex items-center justify-center bg-[rgba(125,141,166,0.10)] hover:bg-[rgba(125,141,166,0.20)] transition-colors border-0"
          style={{ padding: '6px', borderRadius: '4px', cursor: 'pointer' }}
          aria-label="Next week"
          data-calendar-arrow
        >
          <RightArrow />
        </button>
      </div>
    </div>
  );
}