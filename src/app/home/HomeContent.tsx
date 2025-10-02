// src/app/home/HomeContent.tsx
"use client";

import { useState, useEffect } from 'react';
import CoxingOverviewCard from '@/components/CoxingOverviewCard';
import FlagStatusCard from '@/components/FlagStatusCard';
import UpcomingSessionsCard from '@/components/UpcomingSessionsCard';
import RecentWaterOutingsCard from '@/components/RecentWaterOutingsCard';
import NextEventCard from '@/components/NextEventCard';
import UpcomingTestsCard from '@/components/UpcomingTestsCard';

export default function HomeContent() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Mobile Layout - Single column, all cards stacked vertically
  if (isMobile) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          padding: '20px',
          paddingTop: '20px',
          borderRadius: '20px',
          background: '#FAFAFB',
          flex: 1,
          overflowY: 'auto',
        }}
      >
        <UpcomingSessionsCard />
        <CoxingOverviewCard />
        <UpcomingTestsCard />
        <FlagStatusCard />
        <NextEventCard />
        <RecentWaterOutingsCard />
      </div>
    );
  }

  // Desktop Layout - 3 columns as original
  return (
    <div
      style={{
        display: 'flex',
        gap: '20px',
        padding: '20px',
        borderRadius: '20px',
        background: '#FAFAFB',
        flex: 1,
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}
    >
      {/* Left column: Coxing (top) and Upcoming Tests (bottom) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          width: '300px',
        }}
      >
        <CoxingOverviewCard />
        <UpcomingTestsCard />
      </div>

      {/* Middle column: Upcoming Sessions and Flag Status */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          width: '300px',
        }}
      >
        <UpcomingSessionsCard />
        <FlagStatusCard />
      </div>

      {/* Right column: Next Event (top) and Recent Outings (bottom) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          width: '300px',
        }}
      >
        <NextEventCard />
        <RecentWaterOutingsCard />
      </div>
    </div>
  );
}
