"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { useCoxingOverview, CoxOverview } from '@/hooks/useCoxingOverview';

function ChevronRightIcon({ color = '#4C6FFF' }: { color?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2.90403 1.02903C3.02607 0.90699 3.22393 0.90699 3.34597 1.02903L7.09597 4.77903C7.21801 4.90107 7.21801 5.09893 7.09597 5.22097L3.34597 8.97097C3.22393 9.09301 3.02607 9.09301 2.90403 8.97097C2.78199 8.84893 2.78199 8.65107 2.90403 8.52903L6.43306 5L2.90403 1.47097C2.78199 1.34893 2.78199 1.15107 2.90403 1.02903Z"
        fill={color}
      />
    </svg>
  );
}

interface CoxRowProps {
  cox: CoxOverview;
}

function CoxRow({ cox }: CoxRowProps) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const dayKeys: Array<keyof typeof cox.availability> = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        alignSelf: 'stretch',
      }}
    >
      {/* Cox initials pill */}
      <div
        style={{
          display: 'flex',
          width: '40px',
          padding: '8px',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '10px',
          borderRadius: '5px',
          background: 'rgb(243, 241, 254)',
          boxShadow: '0 9px 44px 0 rgba(174, 174, 174, 0.10)',
          color: '#6F00FF',
          fontSize: '12px',
          fontWeight: 400, // remove bold from initials pill
          fontFamily: 'Gilroy, sans-serif',
        }}
      >
        {cox.initials}
      </div>

      {/* Days of the week */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          flex: 1,
        }}
      >
        {days.map((day, index) => {
          const isAvailable = cox.availability[dayKeys[index]];
          return (
            <span
              key={`${cox.memberId}-${day}-${index}`}
              style={{
                fontSize: '14px',
                color: isAvailable ? '#6F00FF' : 'inherit',
                // Hard-code Gilroy bold when available, otherwise Gilroy light
                fontFamily: isAvailable ? 'Gilroy, sans-serif' : 'Gilroy, sans-serif',
                fontWeight: isAvailable ? 800 : 300,
              }}
            >
              {day}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function CoxingOverviewCard() {
  const router = useRouter();
  const { coxes, loading, error } = useCoxingOverview();

  const handleNavigate = () => {
    router.push('/coxing');
  };

  return (
    <div
      style={{
        display: 'flex',
        width: '300px',
        height: '300px',
        padding: '20px',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        borderRadius: '20px',
        background: '#FFF',
        boxShadow: '0 9px 44px 0 rgba(174, 174, 174, 0.20)',
        gap: '20px',
      }}
    >
      {/* Header container */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '8px',
          alignSelf: 'stretch',
        }}
      >
        <h2 className="font-bold" style={{ fontSize: '22px' }}>
          Coxing
        </h2>
        <p className="font-light" style={{ fontSize: '14px' }}>
          Who is available this week?
        </p>
      </div>

      {/* Central container for dynamic data */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '12px',
          alignSelf: 'stretch',
          flex: 1,
          overflow: 'auto',
        }}
      >
        {loading && (
          <p className="font-light" style={{ fontSize: '12px', color: '#999' }}>
            Loading...
          </p>
        )}

        {error && (
          <p className="font-light" style={{ fontSize: '12px', color: '#ff0000' }}>
            {error}
          </p>
        )}

        {!loading && !error && coxes.length === 0 && (
          <p className="font-light" style={{ fontSize: '12px', color: '#999' }}>
            No coxes available this week.
          </p>
        )}

        {!loading && !error && coxes.map((cox) => (
          <CoxRow key={cox.memberId} cox={cox} />
        ))}
      </div>

      {/* Navigation button */}
      <button
        onClick={handleNavigate}
        style={{
          display: 'flex',
          width: '30px',
          height: '30px',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          background: '#E1E8FF',
          border: 'none',
          cursor: 'pointer',
          transition: 'background-color 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#D1DAFF';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#E1E8FF';
        }}
        aria-label="Navigate to coxing page"
      >
        <ChevronRightIcon color="#4C6FFF" />
      </button>
    </div>
  );
}
