// src/app/(app shell)/schedule/OutingDrawer.tsx

import React from 'react';

interface OutingDrawerProps {
  outingId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function OutingDrawer({ outingId, isOpen, onClose }: OutingDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose}>
      <div
        className="fixed right-0 top-0 h-full w-96 bg-surface shadow-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Outing Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m18 6-12 12"/>
              <path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        <div className="text-sm text-muted-foreground">
          Outing ID: {outingId}
        </div>

        <div className="mt-4 p-4 bg-muted/50 rounded-lg">
          <p className="text-sm">
            This is a placeholder for the outing details drawer.
            The existing OutingDrawer component will be integrated here.
          </p>
        </div>
      </div>
    </div>
  );
}
