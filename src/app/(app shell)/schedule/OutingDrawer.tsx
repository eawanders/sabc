// src/app/(app shell)/schedule/OutingDrawer.tsx

import React from 'react';
import { useOutingDetails } from '@/hooks/useOutingDetails';
import { AvailabilityStatus } from '@/types/outing';

interface OutingDrawerProps {
  outingId: string;
  isOpen: boolean;
  onClose: () => void;
}

function getStatusColor(status: AvailabilityStatus | null): string {
  switch (status) {
    case AvailabilityStatus.Available:
      return 'text-green-600';
    case AvailabilityStatus.AwaitingApproval:
      return 'text-blue-600';
    case AvailabilityStatus.NotAvailable:
      return 'text-red-600';
    case AvailabilityStatus.Confirmed:
      return 'text-green-700';
    case AvailabilityStatus.Provisional:
      return 'text-yellow-600';
    case AvailabilityStatus.Cancelled:
      return 'text-red-700';
    default:
      return 'text-muted-foreground';
  }
}

export default function OutingDrawer({ outingId, isOpen, onClose }: OutingDrawerProps) {
  const { outing, loading, error } = useOutingDetails(isOpen ? outingId : null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose}>
      <div
        className="fixed right-0 top-0 h-full w-96 bg-surface shadow-lg p-6 overflow-y-auto"
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

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2 text-sm text-muted-foreground">Loading outing details...</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {outing && (
          <div className="space-y-4">
            {/* Basic Info */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-semibold text-base mb-2">
                {(outing.properties.Name as any)?.plain_text || 'Untitled Outing'}
              </h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Division:</strong> {(outing.properties.Div as any)?.select?.name || 'N/A'}</p>
                <p><strong>Type:</strong> {(outing.properties.Type as any)?.select?.name || 'N/A'}</p>
                <p><strong>Shell:</strong> {(outing.properties.Shell as any)?.select?.name || 'N/A'}</p>
                <p><strong>Status:</strong> {(outing.properties.OutingStatus as any)?.status?.name || 'Provisional'}</p>
              </div>
            </div>

            {/* Session Details */}
            {outing.sessionDetailsText && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Session Details</h4>
                <p className="text-sm text-muted-foreground">{outing.sessionDetailsText}</p>
              </div>
            )}

            {/* Seat Assignments */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-3">Seat Assignments</h4>
              <div className="space-y-2">
                {outing.seatAssignments.map((assignment) => (
                  <div key={assignment.seatType} className="flex justify-between items-center py-2 border-b border-muted last:border-b-0">
                    <span className="text-sm font-medium">{assignment.seatType}</span>
                    <div className="text-right">
                      {assignment.member ? (
                        <div>
                          <p className="text-sm">{assignment.member.name}</p>
                          {assignment.availabilityStatus && (
                            <p className={`text-xs ${getStatusColor(assignment.availabilityStatus)}`}>
                              {assignment.availabilityStatus}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-muted-foreground">No assignment</p>
                          <p className={`text-xs ${getStatusColor(assignment.availabilityStatus)}`}>
                            {assignment.availabilityStatus}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Available Seats Count */}
            <div className="p-4 bg-primary/10 rounded-lg">
              <p className="text-sm">
                <strong>{outing.availableSeats.length}</strong> seat{outing.availableSeats.length !== 1 ? 's' : ''} available for assignment
              </p>
              {outing.availableSeats.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Open positions: {outing.availableSeats.join(', ')}
                </p>
              )}
              {outing.availableSeats.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  All positions are assigned or unavailable
                </p>
              )}
            </div>

            {/* Debug Info */}
            <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
              <p>Outing ID: {outingId}</p>
              <p>Last Updated: {new Date(outing.last_edited_time).toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
