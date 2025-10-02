import React from 'react';
import HomeContent from './HomeContent';

export const metadata = {
  title: 'Home',
};

export default function HomePage() {
  return (
    <div className="container mx-auto p-2 flex flex-col h-full mobile-home-page">
      <h1 className="font-bold mobile-hide-header" style={{ fontSize: '32px' }}>Home</h1>

      {/* Welcome text */}
      <p className="font-light" style={{ fontSize: '14px', marginTop: '24px', marginBottom: '24px' }}>
        Welcome to the Home of St Antony&apos;s College, Oxford&apos;s Boat Club.
        <br /><br />
        Use this app to sign up for club outings, coxing, and OURC tests. See outing reports, events, and more!
      </p>

      {/* Container for interactive components */}
      <HomeContent />
    </div>
  );
}