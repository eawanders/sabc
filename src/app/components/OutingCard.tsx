import React from "react";
import { Outing } from "@/types/outing";
import { Member } from "@/types/members";

interface OutingCardProps {
  outing: Outing;
  members: Member[];
  onStateChange?: () => void;
}

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

export default function OutingCard({ outing, members, onStateChange }: OutingCardProps) {
  const [assignments, setAssignments] = React.useState<Record<string, string>>({});
  const [isInitialized, setIsInitialized] = React.useState(false);

  // Helper function to safely access outing properties
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

  // Extract metadata properties according to Linear ticket EDW-20
  const div = outing?.properties?.Div?.select?.name || "No Div Assigned";
  const outingType = outing?.properties?.Type?.select?.name || "No Type Assigned";
  const outingStatus = outing?.properties?.OutingStatus?.status?.name || "Unknown Status";
  const shell = outing?.properties?.Shell?.select?.name || "No Shell Assigned";

  // Format date/time properties
  const startDateTime = outing?.properties?.StartDateTime?.date?.start || "";
  const endDateTime = outing?.properties?.EndDateTime?.date?.start || "";

  // Extract time portion if datetime is available
  const startTime = startDateTime ? new Date(startDateTime).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  }) : "";
  const endTime = endDateTime ? new Date(endDateTime).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  }) : "";

  // Session details
  const sessionDetails = Array.isArray(outing?.properties?.SessionDetails)
    ? outing.properties.SessionDetails.map((detail: { plain_text?: string }) => detail?.plain_text || '').join('')
    : (typeof outing?.properties?.SessionDetails === 'string'
      ? outing.properties.SessionDetails
      : "No session details");

  // Get bank rider member name - the API returns arrays directly for relation properties
  const bankRiderId = Array.isArray(outing?.properties?.CoachBankRider) && outing.properties.CoachBankRider.length > 0
    ? (outing.properties.CoachBankRider[0] as { id: string })?.id
    : null;
  const bankRiderMember = bankRiderId ? members.find(m => m.id === bankRiderId) : null;
  const bankRider = bankRiderMember?.name || "None";

  // Initialize assignments from outing data - FIXED: Remove assignments from dependencies
  React.useEffect(() => {
    if (!outing || !members.length) return;

    console.log(`🔧 Initializing assignments for outing ${outing.id}`);

    const initialAssignments: Record<string, string> = {};
    seatLabels.forEach((seat) => {
      const seatProp = getOutingProperty(seat);
      // The API returns arrays directly for relation properties, not {relation: [...]}
      if (Array.isArray(seatProp) && seatProp.length > 0) {
        const relatedId = (seatProp[0] as { id: string })?.id;
        const matchedMember = members.find((m) => m.id === relatedId);
        if (matchedMember) {
          initialAssignments[seat] = matchedMember.name;
          console.log(`🎯 Pre-filled ${seat} with ${matchedMember.name}`);
        }
      }
    });

    // Always update assignments when outing or members change
    setAssignments(initialAssignments);
    setIsInitialized(true);
    console.log(`✅ Assignments initialized:`, initialAssignments);
  }, [outing?.id, outing, members, getOutingProperty]); // FIXED: Added outing dependency

  const handleAssignmentChange = async (seat: string, memberName: string) => {
    if (!isInitialized) {
      console.warn(`⚠️ Attempted to change assignment before initialization complete`);
      return;
    }

    const prevMemberName = assignments[seat] || "";
    const member = members.find((m) => m.name === memberName) || null;

    console.log(`🔄 Assignment change for ${seat}: "${prevMemberName}" → "${memberName}"`);

    // FIXED: Update local state optimistically but handle rollback on error
    const previousAssignments = { ...assignments };
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
        // FIXED: Rollback on error
        setAssignments(previousAssignments);
        throw new Error("Failed to update Notion");
      }

      console.log(
        member
          ? `✅ Seat ${seat} updated with ${memberName}`
          : `✅ Seat ${seat} cleared`
      );

      // FIXED: Notify parent of state change to refresh data
      if (onStateChange) {
        onStateChange();
      }
    } catch (err) {
      console.error(`❌ Error updating seat ${seat}:`, err);
      // State already rolled back above
      return;
    }

    // Reset availability status whenever assignment changes (member changed, added, or removed)
    if (prevMemberName !== memberName) {
      const statusField = getStatusField(seat);
      console.log(`🔁 Resetting ${statusField} to "Awaiting Approval" due to assignment change`);

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

        console.log(`✅ ${statusField} reset to Awaiting Approval`);

        // Update local status in assignments
        setAssignments((prev) => ({
          ...prev,
          [`${seat}_status`]: "Awaiting Approval",
        }));

        // FIXED: Notify parent of state change after reset
        if (onStateChange) {
          onStateChange();
        }
      } catch (err) {
        console.error(`❌ Error resetting ${statusField}:`, err);
      }
    }
  };

  const handleAvailabilityUpdate = async (seat: string, status: string) => {
    // FIXED: Prevent availability update when no member is selected
    if (!assignments[seat]) {
      console.warn(`⚠️ Cannot set availability for ${seat} - no member selected`);
      return;
    }

    const statusField = getStatusField(seat);

    // Remove the property existence check as all status fields should exist in Notion
    // The check was causing false negatives when members tried to update their status
    console.log(`🔄 Updating availability for ${seat} (${statusField}) to ${status}`);

    try {
      console.log("🔄 Sending availability update with:", {
        outingId: outing.id,
        statusField,
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

      console.log(`✅ ${statusField} updated to ${status}`);

      // Update local state to reflect new status for this seat
      setAssignments((prev) => ({
        ...prev,
        [`${seat}_status`]: status,
      }));

      // FIXED: Notify parent of state change to refresh data
      if (onStateChange) {
        onStateChange();
      }
    } catch (err) {
      console.error(`❌ Error updating ${statusField}:`, err);
      // Show more detailed error information
      if (err instanceof Error) {
        console.error(`❌ Error details:`, err.message);
      }
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md p-4 w-full">
      <div className="mb-4">
        {/* Simple Div title per updated EDW-20 requirements */}
        <h3 className="text-xl font-bold text-gray-800">{div}</h3>

        {/* Outing Type */}
        <p className="text-sm text-gray-600">Outing: {outingType}</p>

        {/* Date */}
        <p className="text-sm text-gray-600">
          Date: {startDateTime ? new Date(startDateTime).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }) : 'TBD'}
        </p>

        {/* Time information */}
        {(startTime || endTime) && (
          <p className="text-sm text-gray-600">
            Time: {startTime}{endTime && startTime ? ` – ${endTime}` : endTime}
          </p>
        )}

        {/* Outing Status with color coding */}
        <p className={`text-sm font-medium ${
          outingStatus === 'Outing Confirmed' ? 'text-green-600' :
          outingStatus === 'Provisional Outing' ? 'text-yellow-600' :
          outingStatus === 'Outing Cancelled' ? 'text-red-600' :
          'text-gray-600'
        }`}>
          Status: {outingStatus}
        </p>

        {/* Shell information */}
        <p className="text-sm text-gray-600">Shell: {shell}</p>

        {/* Session Details */}
        {sessionDetails && sessionDetails !== "No session details" && (
          <p className="text-sm text-gray-600">Session Details: {sessionDetails}</p>
        )}

        {/* Coach/Bank Rider as plain text */}
        <p className="text-sm text-gray-600">Coach/Bank Rider: {bankRider}</p>
      </div>      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {seatLabels.map((seat, idx) => {
          const allKeys = Object.keys(outing?.properties || {});
          console.log(`Checking seat: ${seat}`);
          console.log("Available property keys:", allKeys);
          console.log(`Does outing.properties have '${seat}'?`, getOutingProperty(seat) !== undefined);

          // FIXED: Check if member is selected for this seat
          const isMemberSelected = Boolean(assignments[seat]);
          const currentStatus = assignments[`${seat}_status`];

          return (
            <div key={idx} className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                {seat}
                {isMemberSelected && currentStatus && (
                  <span className="ml-2 text-xs text-gray-500">
                    ({currentStatus})
                  </span>
                )}
              </label>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={assignments[seat] || ""}
                onChange={(e) => handleAssignmentChange(seat, e.target.value)}
              >
                <option value="">-- Select Member --</option>
                {members
                  .filter((member) => {
                    const assignedNames = Object.entries(assignments)
                      .filter(([key]) => key !== seat)
                      .map(([, name]) => name);
                    return !assignedNames.includes(member.name) || member.name === assignments[seat];
                  })
                  .map((member) => (
                    <option key={member.id} value={member.name}>
                      {member.name}
                    </option>
                  ))}
              </select>
              <div className="flex gap-1 mt-1">
                <button
                  className={`text-xs px-2 py-1 rounded ${
                    isMemberSelected
                      ? "bg-green-200 hover:bg-green-300 cursor-pointer"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                  onClick={() => isMemberSelected && handleAvailabilityUpdate(seat, "Available")}
                  disabled={!isMemberSelected}
                  title={isMemberSelected ? "Set as Available" : "Select a member first"}
                >
                  ✅
                </button>
                <button
                  className={`text-xs px-2 py-1 rounded ${
                    isMemberSelected
                      ? "bg-yellow-200 hover:bg-yellow-300 cursor-pointer"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                  onClick={() => isMemberSelected && handleAvailabilityUpdate(seat, "Maybe Available")}
                  disabled={!isMemberSelected}
                  title={isMemberSelected ? "Set as Maybe Available" : "Select a member first"}
                >
                  ❓
                </button>
                <button
                  className={`text-xs px-2 py-1 rounded ${
                    isMemberSelected
                      ? "bg-red-200 hover:bg-red-300 cursor-pointer"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                  onClick={() => isMemberSelected && handleAvailabilityUpdate(seat, "Not Available")}
                  disabled={!isMemberSelected}
                  title={isMemberSelected ? "Set as Not Available" : "Select a member first"}
                >
                  ❌
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}