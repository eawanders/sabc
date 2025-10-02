// src/components/mobile/MobileDrawer.tsx
"use client";

import { useEffect } from "react";
import Image from "next/image";
import MobileNavItem from "./MobileNavItem";

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Close icon for drawer */
function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** Navigation Icons */
function HomeIcon({ stroke = "#425466" }: { stroke?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.02 2.84016L3.63 7.04016C2.73 7.74016 2 9.23016 2 10.3602V17.7702C2 20.0902 3.89 21.9902 6.21 21.9902H17.79C20.11 21.9902 22 20.0902 22 17.7802V10.5002C22 9.29016 21.19 7.74016 20.2 7.05016L14.02 2.72016C12.62 1.74016 10.37 1.79016 9.02 2.84016Z" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 17.99V14.99" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ClockIcon({ stroke = "#425466" }: { stroke?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 12C22 17.52 17.52 22 12 22C6.48 22 2 17.52 2 12C2 6.48 6.48 2 12 2C17.52 2 22 6.48 22 12Z" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M15.71 15.18L12.61 13.33C12.07 13.01 11.63 12.24 11.63 11.61V7.51001" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CoxingIcon({ stroke = "#425466" }: { stroke?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.41003 22C3.41003 18.13 7.26003 15 12 15C12.96 15 13.89 15.13 14.76 15.37" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M22 18C22 18.32 21.96 18.63 21.88 18.93C21.79 19.33 21.63 19.72 21.42 20.06C20.73 21.22 19.46 22 18 22C16.97 22 16.04 21.61 15.34 20.97C15.04 20.71 14.78 20.4 14.58 20.06C14.21 19.46 14 18.75 14 18C14 16.92 14.43 15.93 15.13 15.21C15.86 14.46 16.88 14 18 14C19.18 14 20.25 14.51 20.97 15.33C21.61 16.04 22 16.98 22 18Z" stroke={stroke} strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16.44 18L17.43 18.99L19.56 17.02" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function FlagIcon({ stroke = "#425466" }: { stroke?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 21L8 16M8 16L17.7231 9.51793C18.0866 9.2756 18.0775 8.73848 17.7061 8.50854L8.91581 3.06693C8.5161 2.81949 8 3.10699 8 3.57709V16Z" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 11.0001L14.5 6.52393" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SwimIcon({ stroke = "#425466" }: { stroke?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 15.9998C2.75 15.9998 3.15 15.3498 3.91 15.3498C4.67 15.3498 5.06 15.9998 5.82 15.9998C6.58 15.9998 6.97 15.3498 7.74 15.3498C8.5 15.3498 8.89 15.9998 9.65 15.9998C10.41 15.9998 10.8 15.3498 11.57 15.3498C12.33 15.3498 12.72 15.9998 13.48 15.9998C14.24 15.9998 14.63 15.3498 15.4 15.3498C16.16 15.3498 16.55 15.9998 17.31 15.9998C18.07 15.9998 18.46 15.3498 19.23 15.3498C19.99 15.3498 20.38 15.9998 21.14 15.9998" stroke={stroke} strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 20C2.75 20 3.15 19.35 3.91 19.35C4.67 19.35 5.06 20 5.82 20C6.58 20 6.97 19.35 7.74 19.35C8.5 19.35 8.89 20 9.65 20C10.41 20 10.8 19.35 11.57 19.35C12.33 19.35 12.72 20 13.48 20C14.24 20 14.63 19.35 15.4 19.35C16.16 19.35 16.55 20 17.31 20C18.07 20 18.46 19.35 19.23 19.35C19.99 19.35 20.38 20 21.14 20" stroke={stroke} strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.68 9.48998L11.99 10.18C11.5 10.67 11.14 11.57 11.14 12.26V13.91C11.14 14.6 10.73 15.45 10.29 15.89L8.86998 17.31" stroke={stroke} strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.5 6.5C6.88071 6.5 8 5.38071 8 4C8 2.61929 6.88071 1.5 5.5 1.5C4.11929 1.5 3 2.61929 3 4C3 5.38071 4.11929 6.5 5.5 6.5Z" stroke={stroke} strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M21.41 8.35001L17.47 9.40001C16.84 9.57001 16.37 10.15 16.37 10.8V11.51C16.37 12.41 17.11 13.15 18.01 13.15C18.91 13.15 19.65 12.41 19.65 11.51V8.06001" stroke={stroke} strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function EventsIcon({ stroke = "#425466" }: { stroke?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 2V5" stroke={stroke} strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 2V5" stroke={stroke} strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.5 9.08997H20.5" stroke={stroke} strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M21 8.5V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V8.5C3 5.5 4.5 3.5 8 3.5H16C19.5 3.5 21 5.5 21 8.5Z" stroke={stroke} strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M15.6947 13.7H15.7037" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M15.6947 16.7H15.7037" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11.9955 13.7H12.0045" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11.9955 16.7H12.0045" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8.29431 13.7H8.30329" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8.29431 16.7H8.30329" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function PersonIcon({ stroke = "#425466" }: { stroke?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M20.5901 22C20.5901 18.13 16.7402 15 12.0002 15C7.26015 15 3.41016 18.13 3.41016 22" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SendIcon({ stroke = "#425466" }: { stroke?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.39999 6.32003L15.89 3.49003C19.7 2.22003 21.77 4.30003 20.51 8.11003L17.68 16.6C15.78 22.31 12.66 22.31 10.76 16.6L9.91999 14.08L7.39999 13.24C1.68999 11.34 1.68999 8.23003 7.39999 6.32003Z" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10.11 13.6501L13.69 10.0601" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  // Close drawer on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`
          fixed inset-0 bg-black/50 z-40 md:hidden
          transition-opacity duration-300
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50
          shadow-lg
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
            width: '100vw',
            height: '100vh',
          padding: '32px',
          paddingTop: '120px',
          background: '#FFFFFF'
        }}
      >
        {/* Navigation */}
        <nav style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          width: '100%'
        }}>
          <MobileNavItem
            href="/home"
            icon={<HomeIcon />}
            label="Home"
            onClick={onClose}
          />
          <MobileNavItem
            href="/schedule"
            icon={<ClockIcon />}
            label="Schedule"
            onClick={onClose}
          />
          <MobileNavItem
            href="/coxing"
            icon={<CoxingIcon />}
            label="Coxing"
            onClick={onClose}
          />
          <MobileNavItem
            href="/flag-status"
            icon={<FlagIcon />}
            label="Flag Status"
            onClick={onClose}
          />
          <MobileNavItem
            href="/tests"
            icon={<SwimIcon />}
            label="OURC Tests"
            onClick={onClose}
          />
          <MobileNavItem
            href="/events"
            icon={<EventsIcon />}
            label="Events"
            onClick={onClose}
          />

          {/* Divider */}
          <div style={{ width: '100%', height: '1px', background: '#DFE5F1', margin: '8px 0' }} />

          <MobileNavItem
            href="/membership"
            icon={<PersonIcon />}
            label="Members"
            onClick={onClose}
          />
          <MobileNavItem
            href="/feedback"
            icon={<SendIcon />}
            label="Feedback"
            onClick={onClose}
          />
        </nav>
      </div>
    </>
  );
}
