// src/components/mobile/MobileHeader.tsx
"use client";

import Image from "next/image";
import Link from "next/link";

interface MobileHeaderProps {
  onMenuClick: () => void;
  isOpen?: boolean;
  title?: string;
}

/** Hamburger menu icon */
function HamburgerIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 18H27" stroke="#425466" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 12H27" stroke="#425466" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 24H27" stroke="#425466" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** Close icon (X) */
function CloseIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 12L12 24" stroke="#425466" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 12L24 24" stroke="#425466" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function MobileHeader({ onMenuClick, isOpen = false, title = 'SABC' }: MobileHeaderProps) {
  return (
    <header
      style={{
        display: 'flex',
        width: '100%',
        height: '80px',
        padding: '20px',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#FFF',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        borderBottom: '1px solid #DFE5F1',
      }}
    >
      {/* Logo, Title, and Hamburger Container */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          alignSelf: 'stretch',
        }}
      >
        {/* Icon and Title */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <Link href="/home" style={{ display: 'flex', cursor: 'pointer' }}>
            <Image
              src="/sabc-logo.png"
              alt="SABC Logo"
              width={40}
              height={40}
            />
          </Link>
          <div
            style={{
              color: '#27272e',
              fontFamily: 'Gilroy',
              fontSize: '32px',
              fontWeight: 800,
              lineHeight: 'normal',
            }}
          >
            {title}
          </div>
        </div>

        {/* Hamburger Menu Button */}
        <button
          onClick={onMenuClick}
          style={{
            display: 'flex',
            width: '36px',
            height: '36px',
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: '10px',
            background: '#F6F7F9',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
          aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        >
          {isOpen ? <CloseIcon /> : <HamburgerIcon />}
        </button>
      </div>
    </header>
  );
}
