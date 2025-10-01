"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { useFlagStatus } from '@/hooks/useFlagStatus';

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

export default function FlagStatusCard() {
  const router = useRouter();
  const { flagStatus, loading, error } = useFlagStatus();

  const handleNavigate = () => {
    router.push('/flag-status');
  };

  // Map status_text to image src (remove " Flag" suffix if present)
  const getFlagImage = (status: string | null): string => {
    if (!status) return '/grey.png';

    const flagImageMap: Record<string, string> = {
      'Green': '/green.png',
      'Light Blue': '/light-blue.png',
      'Dark Blue': '/blue.png',
      'Amber': '/amber.png',
      'Red': '/red.png',
      'Black': '/grey.png', // Use grey as fallback for black
      'Grey': '/grey.png',
    };

    // Remove " Flag" suffix if present
    const cleanStatus = status.replace(' Flag', '');
    return flagImageMap[cleanStatus] || '/grey.png';
  };

  // Get display text (ensure it includes "Flag")
  const getDisplayText = (status: string | null): string => {
    if (!status) return 'Grey Flag';
    return status.includes('Flag') ? status : `${status} Flag`;
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
          Flag Status
        </h2>
        <p className="font-light" style={{ fontSize: '14px' }}>
          The latest status of the Isis River flag.
        </p>
      </div>

      {/* Central container for dynamic data */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px',
          alignSelf: 'stretch',
          flex: 1,
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

        {!loading && !error && flagStatus && (
          <>
            {/* Flag Image */}
            <img
              src={getFlagImage(flagStatus)}
              alt={getDisplayText(flagStatus)}
              style={{
                width: '100px',
                height: '100px',
                objectFit: 'contain',
              }}
            />
            {/* Flag Status Text */}
            <p
              style={{
                fontFamily: 'Gilroy, sans-serif',
                fontWeight: 800,
                fontSize: '22px',
                color: '#000',
              }}
            >
              {getDisplayText(flagStatus)}
            </p>
          </>
        )}
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
        aria-label="Navigate to flag status page"
      >
        <ChevronRightIcon color="#4C6FFF" />
      </button>
    </div>
  );
}
