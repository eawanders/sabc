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

// Helper function to get just the number/short name for seat display
const getSeatDisplayName = (seat: string): string => {
  // Extract number from seat names like "2 Seat", "3 Seat", etc.
  if (seat.includes(' Seat')) {
    return seat.replace(' Seat', '');
  }
  // Keep special positions as-is but shorten if needed
  switch (seat) {
    case 'Stroke':
      return 'S';
    case 'Sub1':
      return 'Sub';
    case 'Sub2':
      return 'Sub';
    case 'Sub3':
      return 'Sub';
    case 'Sub4':
      return 'Sub';
    case 'Bow':
      return 'B';
    default:
      return seat; // Cox, Bow stay as-is
  }
};

// RowerRow component for individual seat assignments
interface RowerRowProps {
  seat: string;
  selectedMember: string;
  isSubmitting: boolean;
  members: any[];
  membersLoading: boolean;
  assignments: Record<string, string>;
  onAssignmentChange: (seat: string, memberName: string) => void;
  onAvailabilityUpdate: (seat: string, status: string) => void;
  isLoadingStatus: boolean;
}

const RowerRow: React.FC<RowerRowProps> = ({
  seat,
  selectedMember,
  isSubmitting,
  members,
  membersLoading,
  assignments,
  onAssignmentChange,
  onAvailabilityUpdate,
  isLoadingStatus
}) => {
  const isMemberSelected = Boolean(selectedMember);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      alignSelf: 'stretch'
    }}>
      {/* 1. Seat Number/Label */}
      <div style={{
        display: 'flex',
        width: '40px',
        padding: '8px',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '10px',
        borderRadius: '5px',
        background: '#F3F1FE',
        boxShadow: '0 9px 44px 0 rgba(174, 174, 174, 0.10)'
      }}>
        <span style={{
          color: '#6F00FF',
          fontFamily: 'Gilroy',
          fontSize: '13px',
          fontStyle: 'normal',
          fontWeight: 300,
          lineHeight: 'normal'
        }}>
          {getSeatDisplayName(seat)}
        </span>
      </div>

      {/* 2. Rower Dropdown */}
      <div style={{
        display: 'flex',
        padding: '4px 10px',
        alignItems: 'center',
        gap: '10px',
        flex: '1 0 0',
        alignSelf: 'stretch',
        borderRadius: '5px',
        background: '#FFF',
        boxShadow: '0 9px 44px 0 rgba(174, 174, 174, 0.10)',
        position: 'relative'
      }}>
        {/* Custom styled select wrapper */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flex: '1 0 0',
          position: 'relative'
        }}>
          <select
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              color: '#7D8DA6',
              fontFamily: 'Gilroy',
              fontSize: '13px',
              fontStyle: 'normal',
              fontWeight: 300,
              lineHeight: 'normal',
              appearance: 'none',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              paddingRight: '20px'
            }}
            value={selectedMember || ""}
            onChange={(e) => onAssignmentChange(seat, e.target.value)}
            disabled={isSubmitting || membersLoading}
          >
            <option value="">
              {membersLoading ? 'Loading members...' : 'Select member'}
            </option>
            {members
              .filter((member) => {
                const assignedNames = Object.entries(assignments)
                  .filter(([key]) => key !== seat)
                  .map(([, name]) => name);
                return !assignedNames.includes(member.name) || member.name === selectedMember;
            })
            .map((member) => (
              <option key={member.id} value={member.name}>
                {member.name}
              </option>
            ))}
          </select>

          {/* Custom dropdown arrow */}
          <div style={{
            position: 'absolute',
            right: '0',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center'
          }}>
            <svg width="9" height="6" viewBox="0 0 9 6" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.33325 1.13828L4.83325 4.63828L8.33325 1.13828" stroke="#7D8DA6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      {/* 3. Availability Buttons (Yes/No) - Always visible */}
      <div style={{
        display: 'flex',
        gap: '4px'
      }}>
        {/* Yes Button */}
        <div
          style={{
            display: 'flex',
            width: '32.333px',
            height: '31px',
            padding: '3px 10px',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '10px',
            borderRadius: '5px',
            background: assignments[`${seat}_status`] === "Available" ? '#00C53E' : '#FFF',
            opacity: assignments[`${seat}_status`] === "Available" ? 0.75 : 1,
            boxShadow: '0 9px 44px 0 rgba(174, 174, 174, 0.10)',
            cursor: isMemberSelected && !isLoadingStatus ? 'pointer' : 'not-allowed'
          }}
          onClick={() => {
            if (isMemberSelected && !isLoadingStatus) {
              onAvailabilityUpdate(seat, "Available");
            }
          }}
        >
          <svg width="13" height="14" viewBox="0 0 13 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M2.90259 7.40216L4.95814 9.45772L10.097 4.31883"
              stroke={
                assignments[`${seat}_status`] === "Available"
                  ? "#FFFFFF"  // White when selected
                  : !isMemberSelected
                    ? "rgba(0, 197, 62, 0.5)"  // No member selected: 50% opacity
                    : "#00C53E"                // Member selected: 100% opacity
              }
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* No Button */}
        <div
          style={{
            display: 'flex',
            width: '32.333px',
            height: '31px',
            padding: '3px 10px',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '10px',
            borderRadius: '5px',
            background: assignments[`${seat}_status`] === "Not Available" ? 'rgba(254, 100, 112, 1)' : '#FFF',
            boxShadow: '0 9px 44px 0 rgba(174, 174, 174, 0.10)',
            cursor: isMemberSelected && !isLoadingStatus ? 'pointer' : 'not-allowed'
          }}
          onClick={() => {
            if (isMemberSelected && !isLoadingStatus) {
              onAvailabilityUpdate(seat, "Not Available");
            }
          }}
        >
          <svg width="13" height="14" viewBox="0 0 13 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M4.1392 9.58241L6.83334 6.88828M9.52747 4.19414L6.83334 6.88828M6.83334 6.88828L4.1392 4.19414M6.83334 6.88828L9.52747 9.58241"
              stroke={
                assignments[`${seat}_status`] === "Not Available"
                  ? "#FFFFFF"  // White when selected
                  : !isMemberSelected
                    ? "rgba(254, 100, 112, 0.5)"  // No member selected: 50% opacity
                    : "#FE6470"                   // Member selected: 100% opacity
              }
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};

// Helper function to get pill background color based on type and value
const getPillStyle = (type: 'shell' | 'status', value: string | null) => {
  if (type === 'status') {
    switch (value) {
      case 'Confirmed':
        return { background: '#10B981' }; // Green
      case 'Provisional':
        return { background: '#F59E0B' }; // Yellow/Orange
      case 'Cancelled':
        return { background: '#EF4444' }; // Red
      default:
        return { background: '#6B7280' }; // Gray
    }
  }
  // Shell pills use the primary blue color
  return { background: '#4C6FFF' }; // Primary blue
};

// Pill component
const Pill = ({ children, type, value }: { children: React.ReactNode; type: 'shell' | 'status'; value: string | null }) => (
  <div style={{
    display: 'flex',
    padding: '4px 12px',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    alignSelf: 'stretch',
    borderRadius: '6px',
    ...getPillStyle(type, value)
  }}>
    <span style={{
      color: 'white',
      fontFamily: 'Gilroy',
      fontSize: '12px',
      fontStyle: 'normal',
      fontWeight: 600,
      lineHeight: 'normal'
    }}>
      {children}
    </span>
  </div>
);

export default function OutingDrawer({ outingId, isOpen, onClose }: OutingDrawerProps) {
  const { outing, loading, error, refresh } = useOutingDetails(outingId);
  const { members, loading: membersLoading } = useMembers();

  // State management from the proven OutingCard pattern
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [submittingSeats, setSubmittingSeats] = useState<Set<string>>(new Set());
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
    // Construct from Div and Type properties (like event item headers)
    const divValue = outing?.properties?.Div?.select?.name || "";
    const typeValue = outing?.properties?.Type?.select?.name || "";

    if (divValue && typeValue) {
      return `${divValue} ${typeValue}`;
    } else if (divValue) {
      return `${divValue} Outing`;
    } else if (typeValue) {
      return `${typeValue} Outing`;
    }

    // Fallback to Name property if Div/Type are not available
    if (outing?.properties?.Name?.title?.length && outing.properties.Name.title[0].plain_text) {
      return outing.properties.Name.title[0].plain_text;
    }

    // Final fallback if no data is available
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* 4. Outing Details Section - Sticky */}
          <div style={{
            position: 'sticky',
            top: 0,
            zIndex: 1,
            backgroundColor: '#FFFFF',
            paddingBottom: '16px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Outing Details Card */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                {/* Parent flexbox to arrange details and pills side by side */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  alignSelf: 'stretch'
                }}>
                  {/* Left side - Outing Details */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '6px'
                  }}>
                    {/* 1. Div + Type (e.g., O1 Water Outing) */}
                    <h3 style={{
                      color: '#161736',
                      fontFamily: 'Gilroy',
                      fontSize: '18px',
                    fontStyle: 'normal',
                    fontWeight: 600,
                    lineHeight: 'normal',
                    margin: 0
                  }}>
                    {getOutingTitle()}
                  </h3>

                  {/* 2. Date/Time (e.g., Date: Wednesday 10:00-12:00) */}
                  <div style={{
                    color: '#425466',
                    fontFamily: 'Gilroy',
                    fontSize: '14px',
                    fontStyle: 'normal',
                    fontWeight: 500,
                    lineHeight: 'normal'
                  }}>
                    <span style={{ fontWeight: 600 }}>Date:</span> {(() => {
                      const startDate = (outing.properties.StartDateTime as any)?.date?.start;
                      const endDate = (outing.properties.EndDateTime as any)?.date?.end;

                      if (startDate) {
                        const start = new Date(startDate);
                        const dayName = start.toLocaleDateString('en-US', { weekday: 'long' });
                        const startTime = start.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: false
                        });

                        if (endDate) {
                          const end = new Date(endDate);
                          const endTime = end.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: false
                          });
                          return `${dayName} ${startTime}–${endTime}`;
                        }
                        return `${dayName} ${startTime}`;
                      }
                      return 'Date not set';
                    })()}
                  </div>

                  {/* 3. Bank Rider/Coach */}
                  <div style={{
                    color: '#425466',
                    fontFamily: 'Gilroy',
                    fontSize: '14px',
                    fontStyle: 'normal',
                    fontWeight: 500,
                    lineHeight: 'normal'
                  }}>
                    <span style={{ fontWeight: 600 }}>Bank Rider:</span> {(() => {
                      const bankRiderRelation = (outing.properties.CoachBankRider as any)?.relation;
                      if (bankRiderRelation && bankRiderRelation.length > 0) {
                        // For now, we'll show the relation ID since we need to match it with members
                        // This would ideally be resolved to actual member names
                        const member = members.find(m => m.id === bankRiderRelation[0].id);
                        return member ? member.name : 'Loading...';
                      }
                      return 'None';
                    })()}
                  </div>
                </div>

                {/* Right side - Pills */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: '8px'
                }}>
                  {/* 4. Shell - Pill Component */}
                  <Pill type="shell" value={(outing.properties.Shell as any)?.select?.name || null}>
                    {(outing.properties.Shell as any)?.select?.name || 'N/A'}
                  </Pill>

                  {/* 5. Outing Status - Pill Component */}
                  <Pill type="status" value={(outing.properties.OutingStatus as any)?.status?.name || null}>
                    {(outing.properties.OutingStatus as any)?.status?.name || 'Provisional'}
                  </Pill>
                </div>
              </div>
            </div>

            {/* 6. Session Details */}
            {outing.sessionDetailsText && (
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p style={{
                  color: '#425466',
                  fontFamily: 'Gilroy',
                  fontSize: '14px',
                  fontStyle: 'normal',
                  fontWeight: 400,
                  lineHeight: '1.4',
                  margin: 0
                }}>{outing.sessionDetailsText}</p>
              </div>
            )}
            </div>
          </div>

          {/* 5. Crew Assignments Section - Scrollable */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            paddingTop: '16px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Rowers Section */}
            <h4 style={{
              color: '#161736',
              fontFamily: 'Gilroy',
              fontSize: '18px',
              fontStyle: 'normal',
              fontWeight: 800,
              lineHeight: 'normal',
              margin: '0 0 16px 0'
            }}>Rowers</h4>

            {/* Interactive Seat Assignments with Member Selection - Dropdowns Container */}
            <div className="bg-white rounded-lg p-4 shadow-sm" style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {seatLabels.filter(seat => !seat.startsWith('Sub')).map((seat) => (
                  <RowerRow
                    key={seat}
                    seat={seat}
                    selectedMember={assignments[seat]}
                    isSubmitting={submittingSeats.has(seat)}
                    members={members}
                    membersLoading={membersLoading}
                    assignments={assignments}
                    onAssignmentChange={handleAssignmentChange}
                    onAvailabilityUpdate={handleAvailabilityUpdate}
                    isLoadingStatus={isLoadingStatus}
                  />
                ))}
              </div>
            </div>

            {/* Subs Section */}
            <h4 style={{
              color: '#161736',
              fontFamily: 'Gilroy',
              fontSize: '18px',
              fontStyle: 'normal',
              fontWeight: 800,
              lineHeight: 'normal',
              margin: '0 0 16px 0'
            }}>Subs</h4>

            {/* Subs Assignments Container */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {seatLabels.filter(seat => seat.startsWith('Sub')).map((seat) => (
                  <RowerRow
                    key={seat}
                    seat={seat}
                    selectedMember={assignments[seat]}
                    isSubmitting={submittingSeats.has(seat)}
                    members={members}
                    membersLoading={membersLoading}
                    assignments={assignments}
                    onAssignmentChange={handleAssignmentChange}
                    onAvailabilityUpdate={handleAvailabilityUpdate}
                    isLoadingStatus={isLoadingStatus}
                  />
                ))}
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
