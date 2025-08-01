import React from "react";
import { Outing } from "@/types/outing";
import { Member } from "@/types/members";
import CheckCircle from "./icons/CheckCircle";
import ColorWheel from "./icons/ColorWheel";
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
    <div className="bg-white w-full max-w-[350px]" style={{
      display: 'inline-flex',
      padding: '30px 20px',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '10px',
      borderRadius: '12px',
      border: '1px solid rgba(170, 170, 170, 0.45)'
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
        <div className="flex flex-col gap-4">
          {/* Outing Title */}
          <h3 className="text-xl font-extrabold text-black leading-tight">
            O1 Water Outing
          </h3>

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
                    <CheckCircle />
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
                    <ColorWheel />
                  </div>
                  <span className="text-sm text-black whitespace-nowrap">{bankRider}</span>
                </div>
              </div>
            </div>

            {/* Status Badge - Now in same flex container */}
            <div className="flex items-center justify-center" style={{
              width: "83px",
              borderRadius: "5.239px",
              background: "#FFD9A8",
              padding: "3px 10px"
            }}>
              <span className="text-xs font-medium text-black text-center">Confirmed</span>
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
              const currentStatus = assignments[`${seat}_status`];
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
                      background: "#FFF",
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
                          color: "#1c1c1c",
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
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        height: "100%"
                      }}
                      className={`hover:opacity-80 transition-opacity duration-150 ${
                        isMemberSelected ? "cursor-pointer" : "cursor-not-allowed opacity-40"
                      }`}
                      onClick={() => isMemberSelected && handleAvailabilityUpdate(seat, "Available")}
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
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        height: "100%"
                      }}
                      className={`hover:opacity-80 transition-opacity duration-150 ${
                        isMemberSelected ? "cursor-pointer" : "cursor-not-allowed opacity-40"
                      }`}
                      onClick={() => isMemberSelected && handleAvailabilityUpdate(seat, "Maybe Available")}
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
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        height: "100%"
                      }}
                      className={`hover:opacity-80 transition-opacity duration-150 ${
                        isMemberSelected ? "cursor-pointer" : "cursor-not-allowed opacity-40"
                      }`}
                      onClick={() => isMemberSelected && handleAvailabilityUpdate(seat, "Not Available")}
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