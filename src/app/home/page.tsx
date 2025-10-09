"use client";

import React, { useState, useEffect } from 'react';
import HomeContent from './HomeContent';

export default function HomePage() {
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
    <div className="container mx-auto p-2 flex flex-col h-full mobile-home-page">
      <h1 className="font-bold mobile-hide-header" style={{ fontSize: '32px' }}>Home</h1>

      {/* Welcome text */}
      <p className="font-light" style={{
        fontSize: '14px',
        marginTop: '24px',
        marginBottom: '24px',
        textAlign: isMobile ? 'center' : 'left'
      }}>
        Welcome to St Antony&apos;s College, Oxford&apos;s Boat Club.
        <br /><br />
        Use this app to sign up for club outings, coxing, and OURC tests. See outing reports, events, and more!
      </p>

      {/* Container for interactive components */}
      <HomeContent />
    </div>
  );
}