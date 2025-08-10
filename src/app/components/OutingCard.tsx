import React from "react";
import { Outing } from "@/types/outing";
import { Member } from "@/types/members";
import Clock from "./icons/Clock";
import Rider from "./icons/Rider";
import Cube from "./icons/Cube";
import AvailableIcon from "./icons/AvailableIcon";
import MaybeIcon from "./icons/MaybeIcon";
import UnavailableIcon from "./icons/UnavailableIcon";

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
  const [isLoadingStatus, setIsLoadingStatus] = React.useState(false);

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

  // Helper function to get the actual backend property name for the status
  const getNotionStatusField = (statusField: string): string => {
    const notionFieldMapping: Record<string, string> = {
      'CoxStatus': 'Cox Status',
      'StrokeStatus': 'Stroke Status',
      'BowStatus': 'Bow Status',
      '7 SeatStatus': '7 Seat Status',
      '6 SeatStatus': '6 Seat Status',
      '5 SeatStatus': '5 Seat Status',
      '4 SeatStatus': '4 Seat Status',
      '3 SeatStatus': '3 Seat Status',
      '2 SeatStatus': '2 Seat Status',
      'Sub1Status': 'Sub 1 Status',
      'Sub2Status': 'Sub 2 Status',
      'Sub3Status': 'Sub 3 Status',
      'Sub4Status': 'Sub 4 Status'
    };

    return notionFieldMapping[statusField] || statusField;
  };

  // Helper function to refresh the status for a specific seat from the backend
  const refreshSeatStatus = async (seat: string) => {
    try {
      // This is a placeholder for how we'd implement direct status fetching
      // In a real implementation, we might have an API endpoint to get just the status
      // For now, we'll rely on the parent component's refresh mechanism

      // Get the status field
      const statusField = getStatusField(seat);
      const notionStatusField = getNotionStatusField(statusField);

      console.log(`🔄 Attempting to refresh status for ${seat} (${statusField} → ${notionStatusField})`);

      // If onStateChange is defined, call it to refresh the entire outing
      if (onStateChange) {
        console.log(`🔄 Triggering parent refresh to update status for ${seat}`);
        onStateChange();
        return true;
      } else {
        console.warn(`⚠️ Cannot refresh status for ${seat} - no onStateChange handler provided`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error refreshing status for ${seat}:`, error);
      return false;
    }
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

  // Helper function to get status colors
  const getStatusColors = (status: string): { bg: string; text: string } => {
    switch (status) {
      // Outing statuses - Updated with the new color scheme
      case "Outing Confirmed":
      case "Confirmed":
        return { bg: "#00C53E", text: "#FFFFFF" }; // Bright green with dark green text for contrast
      case "Provisional Outing":
      case "Provisional":
        return { bg: "#6F00FF", text: "#FFFFFF" }; // Purple with white text for contrast
      case "Outing Cancelled":
      case "Cancelled":
        return { bg: "#8B4513", text: "#FFFFFF" }; // Brown with white text for contrast

      // Rower availability statuses
      case "Available":
        return { bg: "#30FF78", text: "#006400" }; // Green bg, dark green text
      case "Maybe Available":
        return { bg: "#CCEBFF", text: "#00008B" }; // Light blue bg, dark blue text
      case "Not Available":
        return { bg: "#FF7E7E", text: "#800000" }; // Light red bg, dark red text

      // Common statuses
      case "Awaiting Approval":
        return { bg: "#FFFACD", text: "#8B4513" }; // Light yellow bg, brown text

      default:
        return { bg: "#FFD9A8", text: "#000000" }; // Orange bg, black text for unknown status
    }
  };

  // Extract metadata properties according to Linear ticket EDW-20
  const div = outing?.properties?.Div?.select?.name || "No Div Assigned";
  const outingType = outing?.properties?.Type?.select?.name || "No Type Assigned";
  const outingStatus = outing?.properties?.OutingStatus?.status?.name || "Unknown Status";
  const shell = outing?.properties?.Shell?.select?.name || "No Shell Assigned";

  // Debug log to help verify title values
  console.log(`🏆 Outing Title Components: Div="${div}", Type="${outingType}", Combined="${getOutingTitle()}"`);

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
  const bankRider = bankRiderMember?.name || "No Bank Rider/Coach";

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

  // Initialize assignments from outing data - FIXED: Remove assignments from dependencies
  React.useEffect(() => {
    if (!outing || !members.length) return;

    setIsLoadingStatus(true);
    console.log(`🔧 Initializing assignments for outing ${outing.id}`);

    const initialAssignments: Record<string, string> = {};

    // First pass: Get all member assignments
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

      // Second pass: Get all status values by looking for the actual Notion property names
    seatLabels.forEach((seat) => {
      const statusField = getStatusField(seat);
      const notionStatusField = getNotionStatusField(statusField);

      // Try all possible ways the status could be stored
      const statusVariations = [
        // Try the mapped Notion property name (e.g. "Cox Status")
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
    });    // Debug all Notion properties
    console.log("📊 All Notion properties:", Object.keys(outing?.properties || {}));

    // Always update assignments when outing or members change
    setAssignments(initialAssignments);
    setIsInitialized(true);
    setIsLoadingStatus(false);
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

    // Track if we're removing a member
    const isRemovingMember = prevMemberName !== "" && memberName === "";

    setAssignments((prev) => {
      const updated = { ...prev };
      if (memberName === "") {
        delete updated[seat];
        // Don't delete the status immediately when clearing a member
        // We'll update it to "Awaiting Approval" later in the backend
        // But visually we want to preserve status for UI consistency until API call completes
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

      // Handle status update for both adding/changing a member OR removing a member
      // The difference is that for removed members, we want to keep the status in the backend
      // but visually show nothing in the UI
      const statusField = getStatusField(seat);

      if ((memberName !== "" && prevMemberName !== memberName) || isRemovingMember) {
        // Always update to "Awaiting Approval" when there's a change (new member, change member, or remove member)
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
          // Even when removing a member, we set the status in the backend to "Awaiting Approval"
          // to maintain consistency when the seat is assigned again
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

      // FIXED: Notify parent of state change to refresh data
      if (onStateChange) {
        onStateChange();
      }
    } catch (err) {
      console.error(`❌ Error updating seat ${seat}:`, err);
      // State already rolled back above
      return;
    }
  };

  const handleAvailabilityUpdate = async (seat: string, status: string) => {
    // FIXED: Prevent availability update when no member is selected
    if (!assignments[seat]) {
      console.warn(`⚠️ Cannot set availability for ${seat} - no member selected`);
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

      // FIXED: Notify parent of state change to refresh data
      if (onStateChange) {
        onStateChange();
      }

      // Get latest availability from backend to ensure consistency
      await refreshSeatStatus(seat);
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
  };  return (
    <div className="w-full font-inter" style={{
      display: 'inline-flex',
      padding: '30px 20px',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '10px',
      borderRadius: '12px',
      border: '1px solid rgba(170, 170, 170, 0.45)',
      backgroundColor: '#FFFFFF',
      fontFamily: 'var(--font-inter), system-ui, sans-serif'
    }}>
      <div style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: "16px",
        alignSelf: "stretch"
      }}>
        {/* Card Metadata */}
        <div className="flex flex-col" style={{ width: "100%", gap: "16px" }}>
          {/* Outing Title in its own flexbox */}
          <div className="flex flex-col" style={{ width: "100%", margin: 0, padding: 0 }}>
            <h3 className="text-xl font-extrabold text-black leading-tight" style={{ margin: 0, padding: 0 }}>
              {getOutingTitle()}
            </h3>
            {/* Optional: Show div and type as separate subtitle if needed
            <div className="text-sm text-gray-600" style={{ marginTop: '2px' }}>
              {div !== "No Div Assigned" && outingType !== "No Type Assigned" ? `${div} · ${outingType}` : ''}
            </div>
            */}
          </div>

          {/* Day, Time, Shell, Bank Rider & Status - Aligned in same flex container */}
          <div className="flex justify-between items-start" style={{ width: "100%" }}>
            <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "10px",
                minWidth: "240px"
              }}>
              {/* Day */}
              <div style={{
                color: "#6F00FF",
                textAlign: "center",
                fontSize: "16px",
                fontStyle: "normal",
                fontWeight: 600,
                lineHeight: "normal"
              }}>
                {startDateTime ? new Date(startDateTime).toLocaleDateString('en-GB', { weekday: 'long' }) : 'Wednesday'}
              </div>

              {/* Details with Icons */}
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "6px",
                alignSelf: "stretch"
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  alignSelf: "stretch"
                }}>
                  <div className="w-6 h-6 flex items-center justify-center">
                    <Clock />
                  </div>
                  <span className="text-sm text-black whitespace-nowrap">
                    {(startTime || endTime)
                      ? `${startTime}${endTime && startTime ? `–${endTime}` : endTime}`
                      : '07:00–09:00'}
                  </span>
                </div>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  alignSelf: "stretch"
                }}>
                  <div className="w-5 h-5 flex items-center justify-center">
                    <Cube />
                  </div>
                  <span className="text-sm text-black whitespace-nowrap">{shell}</span>
                </div>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  alignSelf: "stretch"
                }}>
                  <div className="w-5 h-5 flex items-center justify-center">
                    <Rider />
                  </div>
                  <span className="text-sm text-black whitespace-nowrap">{bankRider}</span>
                </div>
              </div>
            </div>

            {/* Status Badge - Now in same flex container with dynamic color */}
            <div className="flex items-center justify-center" style={{
              width: "auto",
              minWidth: "83px",
              borderRadius: "5.239px",
              background: getStatusColors(outingStatus).bg,
              padding: "3px 10px"
            }}>
              <span className="text-xs font-medium text-center" style={{
                color: getStatusColors(outingStatus).text,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "120px",
                display: "block"
              }}>{outingStatus}</span>
            </div>
          </div>
        </div>

        {/* Rowers Section */}
        <div className="flex flex-col gap-4" style={{ width: "100%" }}>
          <h4 className="text-md font-semibold text-black">Rowers</h4>
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "16px",
            width: "100%"
          }}>
            {seatLabels.map((seat, idx) => {
              const isMemberSelected = Boolean(assignments[seat]);

              // Get the current status with proper fallback logic
              let currentStatus = assignments[`${seat}_status`];

              // For debugging - ensure we're looking at the right keys
              if (isMemberSelected && !currentStatus) {
                // List all keys in assignments that contain the word "status"
                const statusKeys = Object.keys(assignments).filter(key => key.toLowerCase().includes("status"));
                console.log(`🔍 Looking for status for ${seat}. Available status keys:`, statusKeys);
              }

              // Apply fallback if needed
              if (!currentStatus && isMemberSelected) {
                currentStatus = "Awaiting Approval";
                console.log(`⚠️ No status found for ${seat}, using default: "Awaiting Approval"`);
              }

              // If there's no member selected, ensure we don't show any status
              if (!isMemberSelected) {
                currentStatus = "";
                console.log(`ℹ️ No member for ${seat}, clearing status display`);
              }

              // Enhanced logging for better debugging
              console.log(`🔄 Rendering seat ${seat}: Member=${assignments[seat] || "none"}, Status="${currentStatus || "none"}"`);

              return (
                <div key={idx} style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  height: "36px",
                  width: "100%"
                }}>
                  {/* Seat Label */}
                  <div style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    width: "40px",
                    height: "100%",
                    background: "#F3F1FE",
                    borderRadius: "5px",
                    color: "#6f00ff",
                    fontSize: "12px",
                    fontWeight: 500
                  }}>
                    {seat === "Cox" ? "Cox" :
                    seat === "Stroke" ? "S" :
                    seat === "Bow" ? "B" :
                    seat.includes("Seat") ? seat.split(" ")[0] :
                    seat.includes("Sub") ? "S" + seat.substring(3) : seat}
                  </div>

                  {/* Member Select Dropdown */}
                  <div style={{
                    flexGrow: 1,
                    height: "100%",
                    display: "flex",
                    alignItems: "center"
                  }}>
                    <div style={{
                      width: "100%",
                      borderRadius: "5px",
                      border: "0.5px solid #D9D9D9",
                      background: isLoadingStatus ? "#f5f5f5" : (currentStatus ? getStatusColors(currentStatus).bg : "#FFF"),
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: "10px",
                      paddingRight: "10px"
                    }}>
                      <select
                        style={{
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          fontSize: "14px",
                          color: currentStatus ? getStatusColors(currentStatus).text : "#1c1c1c",
                          fontWeight: isMemberSelected ? 500 : 400,
                          width: "100%",
                          WebkitAppearance: "none",
                          MozAppearance: "none",
                          appearance: "none"
                        }}
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
                    </div>
                  </div>

                  {/* Availability Icons */}
                  <div style={{
                    display: "flex",
                    paddingLeft: "10px",
                    paddingRight: "10px",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "5px",
                    borderRadius: "5px",
                    border: "0.5px solid #D9D9D9",
                    background: "#FFF",
                    height: "100%",
                    width: "110px"
                  }}>
                    <button
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: currentStatus === "Available" ? `${getStatusColors("Available").bg}50` : "transparent",
                        width: "33%",
                        border: "none",
                        padding: 0,
                        height: "100%",
                        borderRadius: "3px"
                      }}
                      className={`hover:opacity-80 ${
                        isLoadingStatus ? "cursor-wait opacity-50" :
                        isMemberSelected ? "cursor-pointer" : "cursor-not-allowed opacity-40"
                      }`}
                      onClick={() => !isLoadingStatus && isMemberSelected && handleAvailabilityUpdate(seat, "Available")}
                      disabled={!isMemberSelected}
                      title={isMemberSelected ? "Set as Available" : "Select a member first"}
                      type="button"
                    >
                      <AvailableIcon />
                    </button>
                    <button
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: currentStatus === "Maybe Available" ? `${getStatusColors("Maybe Available").bg}50` : "transparent",
                        width: "33%",
                        border: "none",
                        padding: 0,
                        height: "100%",
                        borderRadius: "3px"
                      }}
                      className={`hover:opacity-80 ${
                        isLoadingStatus ? "cursor-wait opacity-50" :
                        isMemberSelected ? "cursor-pointer" : "cursor-not-allowed opacity-40"
                      }`}
                      onClick={() => !isLoadingStatus && isMemberSelected && handleAvailabilityUpdate(seat, "Maybe Available")}
                      disabled={!isMemberSelected}
                      title={isMemberSelected ? "Set as Maybe Available" : "Select a member first"}
                      type="button"
                    >
                      <MaybeIcon />
                    </button>
                    <button
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: currentStatus === "Not Available" ? `${getStatusColors("Not Available").bg}50` : "transparent",
                        width: "33%",
                        border: "none",
                        padding: 0,
                        height: "100%",
                        borderRadius: "3px"
                      }}
                      className={`hover:opacity-80 ${
                        isLoadingStatus ? "cursor-wait opacity-50" :
                        isMemberSelected ? "cursor-pointer" : "cursor-not-allowed opacity-40"
                      }`}
                      onClick={() => !isLoadingStatus && isMemberSelected && handleAvailabilityUpdate(seat, "Not Available")}
                      disabled={!isMemberSelected}
                      title={isMemberSelected ? "Set as Not Available" : "Select a member first"}
                      type="button"
                    >
                      <UnavailableIcon />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}