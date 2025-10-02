import React from 'react';
import CoxingOverviewCard from '@/components/CoxingOverviewCard';
import FlagStatusCard from '@/components/FlagStatusCard';
import UpcomingSessionsCard from '@/components/UpcomingSessionsCard';
import RecentWaterOutingsCard from '@/components/RecentWaterOutingsCard';

export const metadata = {
  title: 'Home',
};

export default function HomePage() {
  return (
    <div className="container mx-auto p-2 flex flex-col h-full">
      <h1 className="font-bold" style={{ fontSize: '32px' }}>Home</h1>

      {/* Welcome text */}
      <p className="font-light" style={{ fontSize: '14px', marginTop: '8px', marginBottom: '20px' }}>
        Welcome to the Home of St Antony&apos;s College, Oxford&apos;s Boat Club.
        <br /><br />
        Use this app to sign up for club outings, coxing, and OURC tests. See outing reports, events, and more!
      </p>

      {/* Container for interactive components */}
      <div
        className="flex flex-1 self-stretch"
        style={{
          padding: '20px',
          alignItems: 'flex-start',
          gap: '20px',
          borderRadius: '20px',
          background: '#FAFAFB',
        }}
      >
        <CoxingOverviewCard />
        <FlagStatusCard />
        <UpcomingSessionsCard />
        <RecentWaterOutingsCard />
      </div>
    </div>
  );
}