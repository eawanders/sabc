// src/app/coxing/CoxingCalendarHeaderResponsive.tsx
"use client";

import React, { useState, useEffect } from 'react';
import CalendarHeader from './CalendarHeader';
import { WeekRange } from '@/types/calendar';
import { Member } from '@/types/members';

interface CoxingCalendarHeaderResponsiveProps {
  currentWeek: WeekRange;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  members: Member[];
  selectedMember: Member | null;
  onMemberChange: (m: Member | null) => void;
  refreshMembers: () => Promise<void>;
}

export default function CoxingCalendarHeaderResponsive(props: CoxingCalendarHeaderResponsiveProps) {
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
      <CalendarHeader {...props} />
    </div>
  );
}
