// src/app/(app shell)/schedule/OutingDrawer.tsx

import React, { useState } from 'react';
import { useOutingDetails } from '@/hooks/useOutingDetails';
import { useMembers } from '@/hooks/useMembers';
import { AvailabilityStatus } from '@/types/outing';
import Sheet from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';

interface OutingDrawerProps {
  outingId: string;
  isOpen: boolean;
  onClose: () => void;
}

// Use the same seat labels from the working OutingCard
const seatLabels = [
  "Cox",
  "Stroke",
  "7 Seat",
  "6 Seat",
  "5 Seat",
  "4 Seat",
  "3 Seat",
  "2 Seat",
  "Bow",
  "Sub1",
  "Sub2",
  "Sub3",
  "Sub4",
];

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
  const { outing, loading, error, refresh } = useOutingDetails(outingId);
  const { members, loading: membersLoading } = useMembers();

  // State management from the proven OutingCard pattern
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [submittingSeats, setSubmittingSeats] = useState<Set<string>>(new Set());
  const [submittingAvailability, setSubmittingAvailability] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus | null>(null);
  const [pendingOptimisticUpdates, setPendingOptimisticUpdates] = useState<Set<string>>(new Set());

  // Use a ref to track current outing ID to prevent unnecessary re-initialization
  const currentOutingIdRef = React.useRef<string | null>(null);

  // Helper functions from the proven OutingCard pattern
  const getOutingProperty = React.useCallback((propertyName: string): unknown => {
    return outing?.properties?.[propertyName as keyof typeof outing.properties];
  }, [outing]);

  // Helper function to map seat names to status field names
  const getStatusField = (seat: string): string => {
    const statusFieldMapping: Record<string, string> = {
      'Cox': 'CoxStatus',
      'Stroke': 'StrokeStatus',
      'Bow': 'BowStatus',
      '7 Seat': '7 SeatStatus',
      '6 Seat': '6 SeatStatus',
      '5 Seat': '5 SeatStatus',
      '4 Seat': '4 SeatStatus',
      '3 Seat': '3 SeatStatus',
      '2 Seat': '2 SeatStatus',
      'Sub1': 'Sub1Status',
      'Sub2': 'Sub2Status',
      'Sub3': 'Sub3Status',
      'Sub4': 'Sub4Status'
    };

    return statusFieldMapping[seat] || `${seat}Status`;
  };

  // Helper function to get the actual backend property name for the status
  const getNotionStatusField = (statusField: string): string => {
    const notionFieldMapping: Record<string, string> = {
      'CoxStatus': 'CoxStatus',
      'StrokeStatus': 'StrokeStatus',
      'BowStatus': 'BowStatus',
      '7 SeatStatus': '7 Seat Status',
      '6 SeatStatus': '6 Seat Status',
      '5 SeatStatus': '5 Seat Status',
      '4 SeatStatus': '4 Seat Status',
      '3 SeatStatus': '3 Seat Status',
      '2 SeatStatus': '2 Seat Status',
      'Sub1Status': 'Sub1Status',
      'Sub2Status': 'Sub2Status',
      'Sub3Status': 'Sub3Status',
      'Sub4Status': 'Sub4Status'
    };

    return notionFieldMapping[statusField] || statusField;
  };

  // Helper function to extract status from Notion property
  const extractStatusFromProperty = (
    property: { status?: { name?: string } } | null | undefined
  ): string | null => {
    if (!property) return null;

    if (property && 'status' in property) {
      return property.status?.name || null;
    }

    return null;
  };

  // Helper function to format title as "Div Type" (e.g. "O1 Water Outing")
  const getOutingTitle = (): string => {
    // First try to use the existing Name property if it exists
    if (outing?.properties?.Name?.title?.length && outing.properties.Name.title[0].plain_text) {
      return outing.properties.Name.title[0].plain_text;
    }

    // Otherwise, construct from Div and Type
    const divValue = outing?.properties?.Div?.select?.name || "";
    const typeValue = outing?.properties?.Type?.select?.name || "";

    if (divValue && typeValue) {
      return `${divValue} ${typeValue}`;
    } else if (divValue) {
      return `${divValue} Outing`;
    } else if (typeValue) {
      return `${typeValue} Outing`;
    }

    // Fallback if no data is available
    return "Unnamed Outing";
  };

  // Initialize assignments from outing data - using the proven pattern
  React.useEffect(() => {
    if (!outing || !members.length) return;

    // Only initialize when the outing ID changes, not on every outing data update
    if (currentOutingIdRef.current === outing.id) return;

    // Reset state for new outing
    if (currentOutingIdRef.current !== outing.id) {
      setIsInitialized(false);
      setAssignments({});
      setPendingOptimisticUpdates(new Set());
      currentOutingIdRef.current = outing.id;
    }

    setIsLoadingStatus(true);
    console.log(`🔧 Initializing assignments for NEW outing ${outing.id}`);

    const initialAssignments: Record<string, string> = {};

    // First pass: Get all member assignments
    seatLabels.forEach((seat) => {
      const seatProp = getOutingProperty(seat);
      console.log(`🔍 Checking seat ${seat} property:`, seatProp);

      // The API returns {relation: [{id: "..."}], has_more: false} structure
      if (seatProp && typeof seatProp === 'object' && 'relation' in seatProp) {
        const relationArray = (seatProp as { relation: { id: string }[] }).relation;
        if (Array.isArray(relationArray) && relationArray.length > 0) {
          const relatedId = relationArray[0].id;
          const matchedMember = members.find((m) => m.id === relatedId);
          if (matchedMember) {
            initialAssignments[seat] = matchedMember.name;
            console.log(`🎯 Pre-filled ${seat} with ${matchedMember.name} (ID: ${relatedId})`);
          } else {
            console.log(`⚠️ No member found for ID ${relatedId} in seat ${seat}`);
          }
        }
      }
    });

    // Second pass: Get all status values by looking for the actual Notion property names
    seatLabels.forEach((seat) => {
      const statusField = getStatusField(seat);
      const notionStatusField = getNotionStatusField(statusField);

      // Try all possible ways the status could be stored
      const statusVariations = [
        // Try the mapped Notion property name (e.g. "CoxStatus")
        outing?.properties?.[notionStatusField as keyof typeof outing.properties],

        // Try the frontend status field (e.g. "CoxStatus")
        outing?.properties?.[statusField as keyof typeof outing.properties],

        // Try with spaces removed (e.g. "CoxStatus" or "Cox Status" without spaces)
        outing?.properties?.[statusField.replace(/\s+/g, '') as keyof typeof outing.properties],
        outing?.properties?.[notionStatusField.replace(/\s+/g, '') as keyof typeof outing.properties],

        // Try with different spacing patterns
        outing?.properties?.[`${seat} Status` as keyof typeof outing.properties],
        outing?.properties?.[`${seat}Status` as keyof typeof outing.properties]
      ];

      // Find the first status property that exists and has a value
      let statusValue = null;
      let sourceName = "";

      for (let i = 0; i < statusVariations.length; i++) {
        const property = statusVariations[i];
        // Only pass to extractStatusFromProperty if it has a 'status' property
        const extractedStatus =
          property && typeof property === "object" && "status" in property
            ? extractStatusFromProperty(property as { status?: { name?: string } })
            : null;

        if (extractedStatus) {
          statusValue = extractedStatus;
          sourceName = ["mapped", "frontend", "no-space-frontend", "no-space-notion", "seat-space", "seat-no-space"][i];
          break;
        }
      }

      // Set the status if we found one
      if (statusValue) {
        initialAssignments[`${seat}_status`] = statusValue;
        console.log(`🔹 Pre-filled ${seat} status with "${statusValue}" (source: ${sourceName})`);
      } else {
        console.log(`ℹ️ No status found for ${seat} under any variation`);

        // If we have a member assigned but no status, default to "Awaiting Approval"
        if (initialAssignments[seat]) {
          initialAssignments[`${seat}_status`] = "Awaiting Approval";
          console.log(`ℹ️ Default status set to "Awaiting Approval" for ${seat}`);
        }
      }
    });

    // Debug all Notion properties
    console.log("📊 All Notion properties:", Object.keys(outing?.properties || {}));

    // Set assignments without merging to avoid stale state
    setAssignments(initialAssignments);

    setIsInitialized(true);
    setIsLoadingStatus(false);
    console.log(`✅ Assignments initialized for outing ${outing.id}:`, initialAssignments);
  }, [outing?.id, members.length, getOutingProperty]);

  // Handle updates to outing data while preserving optimistic updates
  React.useEffect(() => {
    // Only process updates for the current outing and after initialization
    if (!outing || !isInitialized || currentOutingIdRef.current !== outing.id) return;

    // If we have pending optimistic updates, don't overwrite them
    if (pendingOptimisticUpdates.size > 0) {
      console.log(`🔄 Skipping data update due to ${pendingOptimisticUpdates.size} pending optimistic updates`);
      return;
    }

    console.log(`🔄 Updating assignments from fresh outing data (no pending optimistic updates)`);

    // Update assignments from fresh outing data
    const freshAssignments: Record<string, string> = {};

    // Get fresh assignments from backend
    seatLabels.forEach((seat) => {
      const seatProp = getOutingProperty(seat);
      console.log(`🔍 Fresh data for seat ${seat}:`, seatProp);

      // The API returns {relation: [{id: "..."}], has_more: false} structure
      if (seatProp && typeof seatProp === 'object' && 'relation' in seatProp) {
        const relationArray = (seatProp as { relation: { id: string }[] }).relation;
        if (Array.isArray(relationArray) && relationArray.length > 0) {
          const relatedId = relationArray[0].id;
          const matchedMember = members.find((m) => m.id === relatedId);
          if (matchedMember) {
            freshAssignments[seat] = matchedMember.name;
            console.log(`🔄 Fresh assignment for ${seat}: ${matchedMember.name} (ID: ${relatedId})`);
          }
        }
      }

      // Get fresh status data
      const statusField = getStatusField(seat);
      const notionStatusField = getNotionStatusField(statusField);

      const statusVariations = [
        outing?.properties?.[notionStatusField as keyof typeof outing.properties],
        outing?.properties?.[statusField as keyof typeof outing.properties],
        outing?.properties?.[statusField.replace(/\s+/g, '') as keyof typeof outing.properties],
        outing?.properties?.[notionStatusField.replace(/\s+/g, '') as keyof typeof outing.properties],
        outing?.properties?.[`${seat} Status` as keyof typeof outing.properties],
        outing?.properties?.[`${seat}Status` as keyof typeof outing.properties]
      ];

      for (const property of statusVariations) {
        const extractedStatus =
          property && typeof property === "object" && "status" in property
            ? extractStatusFromProperty(property as { status?: { name?: string } })
            : null;

        if (extractedStatus) {
          freshAssignments[`${seat}_status`] = extractedStatus;
          break;
        }
      }
    });

    // Update assignments with fresh data
    setAssignments(freshAssignments);
    console.log(`✅ Updated assignments from fresh data:`, freshAssignments);
  }, [outing, isInitialized, pendingOptimisticUpdates.size, getOutingProperty, members]);

  // Assignment change handler using the proven pattern
  const handleAssignmentChange = async (seat: string, memberName: string) => {
    if (!isInitialized || !outing) {
      console.warn(`⚠️ Attempted to change assignment before initialization complete or no outing data`);
      return;
    }

    const prevMemberName = assignments[seat] || "";
    const member = members.find((m) => m.name === memberName) || null;

    console.log(`🔄 Assignment change for ${seat}: "${prevMemberName}" → "${memberName}"`);

    // Update local state optimistically but handle rollback on error
    const previousAssignments = { ...assignments };

    // Track if we're removing a member
    const isRemovingMember = prevMemberName !== "" && memberName === "";

    // Mark this seat as having a pending optimistic update
    setPendingOptimisticUpdates(prev => new Set([...prev, seat]));

    setAssignments((prev) => {
      const updated = { ...prev };
      if (memberName === "") {
        delete updated[seat];
      } else {
        updated[seat] = memberName;
      }
      return updated;
    });

    try {
      const res = await fetch("/api/assign-seat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outingId: outing.id,
          seat,
          memberId: member ? member.id : null,
        }),
      });

      if (!res.ok) {
        // Rollback on error
        setAssignments(previousAssignments);
        throw new Error("Failed to update Notion");
      }

      console.log(
        member
          ? `✅ Seat ${seat} updated with ${memberName}`
          : `✅ Seat ${seat} cleared`
      );

      // Handle status update for both adding/changing a member OR removing a member
      const statusField = getStatusField(seat);

      if ((memberName !== "" && prevMemberName !== memberName) || isRemovingMember) {
        // Always update to "Awaiting Approval" when there's a change
        console.log(`🔁 Resetting ${statusField} to "Awaiting Approval" due to assignment change`);

        // Optimistically update the UI first
        setAssignments((prev) => {
          const updated = { ...prev };

          if (isRemovingMember) {
            // If removing member, visually remove the status from UI
            delete updated[`${seat}_status`];
          } else {
            // If adding/changing member, show the new status
            updated[`${seat}_status`] = "Awaiting Approval";
          }

          return updated;
        });

        try {
          const res = await fetch("/api/update-availability", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              outingId: outing.id,
              statusField,
              status: "Awaiting Approval",
            }),
          });

          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Failed to reset availability: ${errorText}`);
          }

          console.log(`✅ ${statusField} reset to "Awaiting Approval"`);
        } catch (err) {
          console.error(`❌ Error resetting ${statusField}:`, err);
          // Revert on error
          setAssignments((prev) => {
            const updated = { ...prev };

            // Restore previous status
            if (previousAssignments[`${seat}_status`]) {
              updated[`${seat}_status`] = previousAssignments[`${seat}_status`];
            } else {
              delete updated[`${seat}_status`];
            }

            return updated;
          });
        }
      }

      // Refresh the data immediately to get updated backend state
      if (refresh) {
        await refresh();
        // Clear the optimistic update flag after a longer delay to ensure backend consistency
        setTimeout(() => {
          setPendingOptimisticUpdates(prev => {
            const updated = new Set(prev);
            updated.delete(seat);
            console.log(`🧹 Cleared optimistic update flag for ${seat}`);
            return updated;
          });
        }, 1500); // Longer delay to ensure backend consistency
      }
    } catch (err) {
      console.error(`❌ Error updating seat ${seat}:`, err);
      // Clear the optimistic update flag on error
      setPendingOptimisticUpdates(prev => {
        const updated = new Set(prev);
        updated.delete(seat);
        return updated;
      });
      // State already rolled back above
      return;
    }
  };

  // Availability update handler using the proven pattern
  const handleAvailabilityUpdate = async (seat: string, status: string) => {
    // Prevent availability update when no member is selected
    if (!assignments[seat] || !outing) {
      console.warn(`⚠️ Cannot set availability for ${seat} - no member selected or no outing data`);
      return;
    }

    setIsLoadingStatus(true);
    const statusField = getStatusField(seat);
    const notionStatusField = getNotionStatusField(statusField);

    console.log(`🔄 Updating availability for ${seat} (${statusField} → ${notionStatusField}) to ${status}`);

    // Store previous status in case we need to roll back
    const previousStatus = assignments[`${seat}_status`];

    // Log the member assigned to this seat for debugging
    const memberForSeat = assignments[seat];
    console.log(`🧑‍🚣 Member for ${seat}: "${memberForSeat}"`);

    try {
      // Only update status if a member is assigned
      if (memberForSeat) {
        // Optimistically update the UI immediately
        setAssignments((prev) => ({
          ...prev,
          [`${seat}_status`]: status,
        }));
      } else {
        console.warn(`⚠️ Tried to update status for ${seat} but no member is assigned`);
        return;
      }

      console.log("🔄 Sending availability update with:", {
        outingId: outing.id,
        statusField,
        notionStatusField,
        status,
      });

      const res = await fetch("/api/update-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outingId: outing.id,
          statusField,
          status,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`❌ API Error Response:`, errorText);
        throw new Error(`Failed to update availability: ${errorText}`);
      }

      const responseData = await res.json();
      console.log(`✅ ${statusField} updated to ${status}`, responseData);

      // Notify parent of state change to refresh data
      if (refresh) {
        refresh();
      }
    } catch (err) {
      console.error(`❌ Error updating ${statusField}:`, err);
      // Show more detailed error information
      if (err instanceof Error) {
        console.error(`❌ Error details:`, err.message);
      }

      // Revert the optimistic update on failure - restore previous status if it existed
      setAssignments((prev) => {
        const updated = { ...prev };
        if (previousStatus) {
          updated[`${seat}_status`] = previousStatus;
        } else {
          delete updated[`${seat}_status`];
        }
        return updated;
      });
    } finally {
      setIsLoadingStatus(false);
    }
  };

  // Global availability update handler
  const handleGlobalAvailabilityUpdate = async (status: AvailabilityStatus) => {
    if (submittingAvailability || !outing) return;

    try {
      setSubmittingAvailability(true);
      setAvailabilityStatus(status); // Optimistic update

      const response = await fetch('/api/update-availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          outingId: outing.id,
          memberId: 'current-user-id', // TODO: Get actual current user ID
          availabilityStatus: status,
        }),
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('Availability update successful:', result);

      // Refresh data to get updated state
      await refresh();

    } catch (error) {
      console.error('Availability update failed:', error);
      setAvailabilityStatus(null); // Revert optimistic update
      alert('Failed to update availability. Please try again.');
    } finally {
      setSubmittingAvailability(false);
    }
  };

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
              {getOutingTitle()}
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

          {/* Interactive Seat Assignments with Member Selection */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h4 className="font-medium mb-4 text-gray-900">Crew Assignments</h4>
            <div className="space-y-4">
              {seatLabels.map((seat) => {
                const isMemberSelected = Boolean(assignments[seat]);
                let currentStatus = assignments[`${seat}_status`];

                // Apply fallback if needed
                if (!currentStatus && isMemberSelected) {
                  currentStatus = "Awaiting Approval";
                  console.log(`⚠️ No status found for ${seat}, using default: "Awaiting Approval"`);
                }

                // If there's no member selected, ensure we don't show any status
                if (!isMemberSelected) {
                  currentStatus = "";
                }

                const isSubmitting = submittingSeats.has(seat);

                return (
                  <div key={seat} className="border rounded-lg p-4 bg-gray-50 border-gray-200">
                    {/* Seat Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">{seat}</span>
                      </div>

                      {/* Status Indicator */}
                      {currentStatus && (
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(currentStatus as AvailabilityStatus)} bg-white`}>
                          {currentStatus}
                        </span>
                      )}
                    </div>

                    {/* Member Assignment Row */}
                    <div className="space-y-3">
                      {/* Member Selection Dropdown */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <select
                            className="w-full text-sm border border-gray-200 rounded px-3 py-2"
                            value={assignments[seat] || ""}
                            onChange={(e) => handleAssignmentChange(seat, e.target.value)}
                            disabled={isSubmitting || membersLoading}
                          >
                            <option value="">
                              {membersLoading ? 'Loading members...' : 'Select a member...'}
                            </option>
                            {members
                              .filter((member) => {
                                const assignedNames = Object.entries(assignments)
                                  .filter(([key]) => key !== seat)
                                  .map(([, name]) => name);
                                return !assignedNames.includes(member.name) || member.name === assignments[seat];
                              })
                              .map((member) => (
                                <option key={member.id} value={member.name}>
                                  {member.name} ({member.memberType})
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      {/* Availability Controls */}
                      {isMemberSelected && (
                        <div className="flex gap-2">
                          <Button
                            variant={currentStatus === "Available" ? "primary" : "outline"}
                            size="sm"
                            onClick={() => handleAvailabilityUpdate(seat, "Available")}
                            disabled={isLoadingStatus}
                            className="flex-1"
                          >
                            Available
                          </Button>
                          <Button
                            variant={currentStatus === "Maybe Available" ? "primary" : "outline"}
                            size="sm"
                            onClick={() => handleAvailabilityUpdate(seat, "Maybe Available")}
                            disabled={isLoadingStatus}
                            className="flex-1"
                          >
                            Maybe
                          </Button>
                          <Button
                            variant={currentStatus === "Not Available" ? "primary" : "outline"}
                            size="sm"
                            onClick={() => handleAvailabilityUpdate(seat, "Not Available")}
                            disabled={isLoadingStatus}
                            className="flex-1"
                          >
                            Not Available
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Global Availability Form */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h4 className="font-medium mb-4 text-gray-900">Set Your Overall Availability</h4>
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">
                Let the coaches know if you're available for this outing
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button
                  variant={availabilityStatus === AvailabilityStatus.Available ? "primary" : "outline"}
                  size="sm"
                  onClick={() => handleGlobalAvailabilityUpdate(AvailabilityStatus.Available)}
                  disabled={submittingAvailability}
                  className="w-full"
                >
                  {submittingAvailability && availabilityStatus === AvailabilityStatus.Available ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Updating...
                    </div>
                  ) : (
                    "Available"
                  )}
                </Button>

                <Button
                  variant={availabilityStatus === AvailabilityStatus.MaybeAvailable ? "primary" : "outline"}
                  size="sm"
                  onClick={() => handleGlobalAvailabilityUpdate(AvailabilityStatus.MaybeAvailable)}
                  disabled={submittingAvailability}
                  className="w-full"
                >
                  {submittingAvailability && availabilityStatus === AvailabilityStatus.MaybeAvailable ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Updating...
                    </div>
                  ) : (
                    "Maybe"
                  )}
                </Button>

                <Button
                  variant={availabilityStatus === AvailabilityStatus.NotAvailable ? "primary" : "outline"}
                  size="sm"
                  onClick={() => handleGlobalAvailabilityUpdate(AvailabilityStatus.NotAvailable)}
                  disabled={submittingAvailability}
                  className="w-full"
                >
                  {submittingAvailability && availabilityStatus === AvailabilityStatus.NotAvailable ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Updating...
                    </div>
                  ) : (
                    "Not Available"
                  )}
                </Button>
              </div>

              {availabilityStatus && !submittingAvailability && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-800">
                    ✓ Availability updated to: <strong>{availabilityStatus}</strong>
                  </p>
                </div>
              )}
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
