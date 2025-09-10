// src/app/(app shell)/schedule/CalendarHeader.tsx

import React, { useState, useRef, useEffect } from 'react';
import { WeekRange } from '@/types/calendar';
import { LeftArrow } from '@/components/icons/LeftArrow';
import { RightArrow } from '@/components/icons/RightArrow';
import Select, { components, DropdownIndicatorProps, GroupBase, OptionProps } from 'react-select';

// Custom DropdownIndicator for react-select with thinner arrow
const DropdownIndicator = (
  props: DropdownIndicatorProps<
    { value: string; label: string },
    false,
    GroupBase<{ value: string; label: string }>
  >
) => (
  <components.DropdownIndicator {...props}>
    <svg style={{ display: 'block' }} width="25" height="25" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
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

// Narrow types to avoid `any` in style functions (prevents eslint no-explicit-any errors on Vercel)
type OptionItem = { value: string; label: string };
interface StyleOptionState {
  isSelected?: boolean;
  isFocused?: boolean;
  selectProps?: { options?: readonly OptionItem[] };
  data?: OptionItem;
}

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
  const [isHover, setIsHover] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      setIsHover(prev => (prev === inside ? prev : inside));
    }

    window.addEventListener('pointermove', onPointerMove);
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, []);
  return (
    <div
      className="flex flex-col items-start w-full"
      style={{ gap: '20px' }}
    >
      {/* Title */}
      <h1 className="text-3xl font-bold">Outing Schedule</h1>

      {/* Week Display and Filter Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          alignSelf: 'stretch',
          width: '100%'
        }}
      >
        {/* Left: navigation buttons first, then week label */}
        <div
          style={{
            display: 'inline-flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div style={{ display: 'inline-flex', gap: '8px' }}>
            <button
              onClick={onPreviousWeek}
              className="flex items-center justify-center bg-[rgba(246,247,249,0.60)] hover:bg-[rgba(125,141,166,0.20)] transition-colors border-0"
              style={{ width: '36px', height: '36px', padding: 0, borderRadius: '10px', cursor: 'pointer' }}
              aria-label="Previous week"
              data-calendar-arrow
            >
              <LeftArrow />
            </button>

            <button
              onClick={onNextWeek}
              className="flex items-center justify-center bg-[rgba(246,247,249,0.60)] hover:bg-[rgba(125,141,166,0.20)] transition-colors border-0"
              style={{ width: '36px', height: '36px', padding: 0, borderRadius: '10px', cursor: 'pointer' }}
              aria-label="Next week"
              data-calendar-arrow
            >
              <RightArrow />
            </button>
          </div>

          <div className="text-muted-foreground" style={{ fontSize: '14px' }}>
            {currentWeek.weekLabel}
          </div>
        </div>

        {/* Right: filter dropdown aligned with calendar */}
  <div ref={wrapperRef} style={{ width: '200px' }}>
          <Select
            components={{ DropdownIndicator }}
            classNamePrefix="rs"
            instanceId="calendar-filter"
            isSearchable={false}
            isClearable={false}
            options={filterOptions}
            value={filterOptions.find(option => option.value === filterType)}
            onChange={(option) => option && onFilterChange(option.value as 'All' | 'Erg' | 'Water' | 'Tank' | 'Gym')}
            styles={{
              control: (base) => ({
                ...base,
                display: 'flex',
                flexDirection: 'row',
                padding: '5px 0',
                justifyContent: 'flex-start',
                alignItems: 'center',
                gap: 0,
                alignSelf: 'stretch',
                background: isHover ? 'rgba(125,141,166,0.20)' : 'rgba(246,247,249,0.60)',
                borderRadius: '10px',
                position: 'relative',
                border: 'none',
                boxShadow: 'none',
                minHeight: '36px',
                fontSize: '14px',
                fontFamily: 'Gilroy',
                cursor: 'pointer',
              }),
              valueContainer: (base) => ({
                ...base,
                padding: '0 20px',
                display: 'flex',
                justifyContent: 'flex-start',
                alignItems: 'center',
                width: '100%'
              }),
              input: (base) => ({
                ...base,
                margin: 0,
                padding: 0,
                height: '28px',
                fontSize: '14px',
                lineHeight: '28px',
                boxShadow: 'none',
                outline: 'none',
              }),
              indicatorsContainer: (base) => ({
                ...base,
                padding: 0,
                height: '100%',
                minHeight: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '44px'
              }),
              singleValue: (base) => ({
                ...base,
                color: '##425466',
                fontSize: '14px',
                lineHeight: '28px',
                fontWeight: 300,
                fontFamily: 'Gilroy',
                textAlign: 'center',
              }),
              placeholder: (base) => ({
                ...base,
                color: '#7D8DA6',
                fontWeight: 300,
              }),
              indicatorSeparator: (base) => ({
                ...base,
                display: 'none',
              }),
              dropdownIndicator: (base) => ({
                ...base,
                padding: 0,
                width: 25,
                height: 25,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#7D8DA6',
                boxSizing: 'border-box',
                marginLeft: 0,
              }),
              menu: (base) => ({
                ...base,
                zIndex: 9999,
                position: 'absolute',
                border: 'none',
                boxShadow: '0 4px 16px 0 rgba(174,174,174,0.10)',
                borderRadius: '10px',
                overflow: 'hidden',
                left: 0,
                right: 0,
                width: '100%',
                minWidth: '100%',
                marginTop: '12px',
              }),
              menuList: (base) => ({
                ...base,
                border: 'none',
                boxShadow: 'none',
                borderRadius: '10px',
                padding: 0,
              }),
              menuPortal: (base) => ({
                ...base,
                zIndex: 9999,
              }),
              option: (base, state: OptionProps<OptionItem, false, GroupBase<OptionItem>>) => {
                const optionListRaw = state && state.selectProps && state.selectProps.options ? state.selectProps.options : [];
                const optionList = (optionListRaw as readonly unknown[]).filter((opt): opt is OptionItem => typeof opt === 'object' && opt !== null && 'value' in opt) as readonly OptionItem[];
                const index = optionList.findIndex((opt) => opt.value === state.data.value);
                const isFirst = index === 0;
                const isLast = index === optionList.length - 1;
                let borderRadius = '0px';
                if ((state.isSelected || state.isFocused) && isFirst && isLast) {
                  borderRadius = '10px';
                } else if ((state.isSelected || state.isFocused) && isFirst) {
                  borderRadius = '10px 10px 0 0';
                } else if ((state.isSelected || state.isFocused) && isLast) {
                  borderRadius = '0 0 10px 10px';
                }
                return {
                  ...base,
                  backgroundColor: state.isSelected ? '#238AFF' : state.isFocused ? '#E6F0FF' : 'transparent',
                  color: state.isSelected ? '#fff' : '#4C5A6E',
                  fontFamily: 'Gilroy',
                  fontSize: '14px',
                  fontWeight: 300,
                  padding: '8px 10px',
                  borderRadius,
                  transition: 'background 0.2s',
                };
              },
            }}
            menuPortalTarget={typeof window !== 'undefined' ? document.body : undefined}
            placeholder="All Sessions"
          />
        </div>
      </div>
    </div>
  );
}