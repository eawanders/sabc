import React from 'react';
import CoxingOverviewCard from '@/components/CoxingOverviewCard';
import FlagStatusCard from '@/components/FlagStatusCard';
import UpcomingSessionsCard from '@/components/UpcomingSessionsCard';
import RecentWaterOutingsCard from '@/components/RecentWaterOutingsCard';
import NextEventCard from '@/components/NextEventCard';
import UpcomingTestsCard from '@/components/UpcomingTestsCard';

export const metadata = {
  title: 'Home',
};

export default function HomePage() {
  return (
    <div className="container mx-auto p-2 flex flex-col h-full">
      <h1 className="font-bold" style={{ fontSize: '32px' }}>Home</h1>

      {/* Welcome text */}
      <p className="font-light" style={{ fontSize: '14px', marginTop: '24px', marginBottom: '24px' }}>
        Welcome to the Home of St Antony&apos;s College, Oxford&apos;s Boat Club.
        <br /><br />
        Use this app to sign up for club outings, coxing, and OURC tests. See outing reports, events, and more!
      </p>

      {/* Container for interactive components */}
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
    </div>
  );
}