// src/app/(app shell)/schedule/CalendarHeaderResponsive.tsx
"use client";

import React, { useState, useEffect } from 'react';
import CalendarHeader from './CalendarHeader';
import { WeekRange } from '@/types/calendar';

interface CalendarHeaderResponsiveProps {
  currentWeek: WeekRange;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  filterType: 'All' | 'Erg' | 'Water' | 'Tank' | 'Gym';
  onFilterChange: (type: 'All' | 'Erg' | 'Water' | 'Tank' | 'Gym') => void;
  memberId?: string;
  onMemberChange: (memberId?: string) => void;
  showFilter?: boolean;
}

export default function CalendarHeaderResponsive(props: CalendarHeaderResponsiveProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // For mobile, we'll pass a wrapper class to CalendarHeader
  return (
    <div className={isMobile ? 'mobile-calendar-header' : ''}>
      <CalendarHeader {...props} />
    </div>
  );
}
