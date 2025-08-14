// src/components/ui/Sheet.tsx

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export default function Sheet({ isOpen, onClose, children, className = '', title }: SheetProps) {
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
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'sheet-title' : undefined}
    >
      {/* Backdrop overlay with blur */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ease-out"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet container with proper layout */}
      <div
        style={{
          display: 'flex',
          padding: '32px',
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
            // Responsive sizing
            width: isMobile ? '100%' : '400px',
            maxWidth: isMobile ? '100%' : '400px',
            height: '100%',
            maxHeight: '100vh'
          }}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with close button */}
          <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
            {title && (
              <h2 id="sheet-title" className="text-lg font-semibold text-gray-900">
                {title}
              </h2>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Close drawer"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="m18 6-12 12"/>
                <path d="m6 6 12 12"/>
              </svg>
            </button>
          </div>

          {/* Sheet body content */}
          <div className="flex-1 px-6 py-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );

  // For now, render directly instead of portal to avoid SSR issues
  // TODO: Investigate portal timing issue in Next.js SSR environment
  return sheetContent;
}
