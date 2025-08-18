// src/components/ui/Sheet.tsx

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
}

export default function Sheet({ isOpen, onClose, children, className = '', title }: SheetProps) {
  // Global click listener to close drawer when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      // If click is outside the sheet content, close
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Check if mounted (client-side only)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      // Store the currently focused element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Focus the sheet when it opens
      setTimeout(() => {
        sheetRef.current?.focus();
      }, 100);
    } else {
      // Restore focus when sheet closes
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Close on Escape
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Trap focus within the sheet
      if (e.key === 'Tab') {
        const focusableElements = sheetRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          // Shift + Tab: if we're on the first element, go to last
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: if we're on the last element, go to first
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !isMounted) return null;

  const sheetContent = (
    <div
      className="fixed inset-0 z-[9999]"
      style={{ pointerEvents: 'none' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'sheet-title' : undefined}
    >
      {/* Backdrop overlay with blur, pointer-events none so it doesn't block app */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ease-out"
        style={{ pointerEvents: 'none' }}
        aria-hidden="true"
      />

      {/* Sheet container with proper layout */}
      <div
        style={{
          display: 'flex',
          padding: '0px',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-end',
          gap: '32px',
          flexShrink: 0,
          position: 'relative',
          height: '100vh',
          width: '100vw'
        }}
      >
        {/* Sheet content */}
        <div
          ref={sheetRef}
          className={`
            relative bg-white overflow-y-auto focus:outline-none
            transform transition-all duration-300 ease-out
            ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
            ${className}
          `}
          style={{
            background: '#FFF',
            boxShadow: '-16px 0 34px 0 rgba(176, 179, 189, 0.10)',
            // Custom flexbox layout as requested
            display: 'flex',
            width: '370px',
            height: '900px',
            padding: '32px',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: '64px',
            flexGrow: 1,
            pointerEvents: 'auto',
          }}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1+2. Title and Close Button in Flexbox */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
            {title && (
              <h2
                id="sheet-title"
                style={{
                  color: '#161736',
                  fontFamily: 'Gilroy',
                  fontSize: '2rem',
                  fontWeight: 700,
                  margin: 0
                }}
              >
                {title}
              </h2>
            )}
            <button
              onClick={onClose}
              className="focus:outline-none"
              aria-label="Close drawer"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M0.708885 13.2912L6.80595 7.19415M12.903 1.09708L6.80595 7.19415M6.80595 7.19415L0.708885 1.09708M6.80595 7.19415L12.903 13.2912"
                  stroke="#7D8DA6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          {/* 3. Sheet Content Container */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );

  // Use portal to render at document body level to avoid parent container constraints
  if (typeof window !== 'undefined' && isMounted) {
    // Create or get portal container
    let portalContainer = document.getElementById('sheet-portal-root');
    if (!portalContainer) {
      portalContainer = document.createElement('div');
      portalContainer.id = 'sheet-portal-root';
      portalContainer.style.position = 'fixed';
      portalContainer.style.top = '0';
      portalContainer.style.left = '0';
      portalContainer.style.width = '100vw';
      portalContainer.style.height = '100vh';
      portalContainer.style.pointerEvents = 'none';
      portalContainer.style.zIndex = '9999';
      document.body.appendChild(portalContainer);
    }

    return createPortal(sheetContent, portalContainer);
  }

  // Fallback for SSR or before mount
  return null;
}
