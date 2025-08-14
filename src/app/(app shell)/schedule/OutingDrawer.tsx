// src/app/(app shell)/schedule/OutingDrawer.tsx

import React from 'react';
import { useOutingDetails } from '@/hooks/useOutingDetails';
import { AvailabilityStatus } from '@/types/outing';
import Sheet from '@/components/ui/Sheet';

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

function getOutingStatusColor(status: string | null): string {
  switch (status) {
    case 'Confirmed':
      return 'text-green-700';
    case 'Provisional':
      return 'text-yellow-600';
    case 'Cancelled':
      return 'text-red-700';
    default:
      return 'text-gray-700';
  }
}

export default function OutingDrawer({ outingId, isOpen, onClose }: OutingDrawerProps) {
  const { outing, loading, error } = useOutingDetails(outingId);

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Outing Details"
    >
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
        <div className="space-y-6">
          {/* Basic Info Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h3 className="font-semibold text-lg mb-3 text-gray-900">
              {(outing.properties.Name as any)?.plain_text || 'Untitled Outing'}
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="font-medium text-gray-600">Division:</span>
                <p className="text-gray-900">{(outing.properties.Div as any)?.select?.name || 'N/A'}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Type:</span>
                <p className="text-gray-900">{(outing.properties.Type as any)?.select?.name || 'N/A'}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Shell:</span>
                <p className="text-gray-900">{(outing.properties.Shell as any)?.select?.name || 'N/A'}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Status:</span>
                <p className={`font-medium ${getOutingStatusColor((outing.properties.OutingStatus as any)?.status?.name)}`}>
                  {(outing.properties.OutingStatus as any)?.status?.name || 'Provisional'}
                </p>
              </div>
            </div>
          </div>

          {/* Session Details */}
          {outing.sessionDetailsText && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <h4 className="font-medium mb-2 text-gray-900">Session Details</h4>
              <p className="text-sm text-gray-700 leading-relaxed">{outing.sessionDetailsText}</p>
            </div>
          )}

          {/* Seat Assignments */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h4 className="font-medium mb-4 text-gray-900">Crew Assignments</h4>
            <div className="space-y-3">
              {outing.seatAssignments.map((assignment) => (
                <div key={assignment.seatType} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-md">
                  <span className="text-sm font-medium text-gray-700">{assignment.seatType}</span>
                  <div className="text-right">
                    {assignment.member ? (
                      <div>
                        <p className="text-sm font-medium text-gray-900">{assignment.member.name}</p>
                        {assignment.availabilityStatus && (
                          <p className={`text-xs ${getStatusColor(assignment.availabilityStatus)}`}>
                            {assignment.availabilityStatus}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-gray-500">Available</p>
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

          {/* Available Seats Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h4 className="font-medium text-blue-900">Assignment Summary</h4>
            </div>
            <p className="text-sm text-blue-800">
              <strong>{outing.availableSeats.length}</strong> position{outing.availableSeats.length !== 1 ? 's' : ''} available for signup
            </p>
            {outing.availableSeats.length > 0 && (
              <p className="text-xs text-blue-700 mt-1">
                Open: {outing.availableSeats.join(', ')}
              </p>
            )}
            {outing.availableSeats.length === 0 && (
              <p className="text-xs text-blue-700 mt-1">
                All positions are assigned or unavailable
              </p>
            )}
          </div>

          {/* Debug Info - Show only in development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-gray-400 bg-gray-100 p-2 rounded text-center">
              <p>ID: {outingId.slice(-8)}</p>
              <p>Updated: {new Date(outing.last_edited_time).toLocaleString()}</p>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
