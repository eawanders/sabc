"use client";

import React from 'react';
import { useRouter } from 'next/navigation';

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

export default function MembershipSignUp() {
  const router = useRouter();

  const handleClick = () => {
    router.push('/membership');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '32px',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <p className="text-muted-foreground text-center">
          Don&apos;t see your name in the list of available members?
        </p>
        <p className="text-muted-foreground text-center">
          Sign up for SABC membership and your name will appear.
        </p>
        <p className="text-muted-foreground text-center">
          New rowers who want to trial or be a guest can add themselves by typing their name into the &apos;Select Member&apos; input box on a session.
        </p>
      </div>
      <button
        onClick={handleClick}
        style={{
          display: 'flex',
          padding: '12px 20px',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          borderRadius: '6px',
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
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          alignSelf: 'stretch',
          gap: '8px'
        }}>
          <span style={{
            color: 'var(--Theme-Primary-Default, #4C6FFF)',
            fontFamily: 'Gilroy',
            fontSize: '12px',
            fontStyle: 'normal',
            fontWeight: 800,
            lineHeight: '12px'
          }}>
            Membership Sign Up
          </span>
          <ChevronRightIcon color="#4C6FFF" />
        </div>
      </button>
    </div>
  );
}