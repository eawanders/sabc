// src/app/tests/TestCalendarHeaderResponsive.tsx
"use client";

import React, { useState, useEffect } from 'react';
import TestCalendarHeader from './TestCalendarHeader';
import { WeekRange } from '@/types/calendar';
import { TestFilterType } from '@/types/test';

interface TestCalendarHeaderResponsiveProps {
  currentWeek: WeekRange;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  filterType: TestFilterType;
  onFilterChange: (type: TestFilterType) => void;
  filterOptions: { value: TestFilterType; label: string }[];
  showFilter?: boolean;
}

export default function TestCalendarHeaderResponsive(props: TestCalendarHeaderResponsiveProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className={isMobile ? 'mobile-calendar-header' : ''}>
      <TestCalendarHeader {...props} />
    </div>
  );
}
