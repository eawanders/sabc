import React from "react";
import { Outing } from "@/types/outing";
import { Member } from "@/types/members";

interface OutingCardProps {
  outing: Outing;
  members: Member[];
}

export default function OutingCard({ outing, members }: OutingCardProps) {
  const [assignments, setAssignments] = React.useState<Record<string, string>>({});

  // Helper function to safely access outing properties
  const getOutingProperty = (propertyName: string): any => {
    return (outing?.properties as any)?.[propertyName];
  };

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

  const title = typeof outing?.properties?.Name === 'string' ? outing.properties.Name : "Untitled";
  const startTime = typeof outing?.properties?.StartDateTime === 'string' ? outing.properties.StartDateTime : "";
  const endTime = typeof outing?.properties?.EndDateTime === 'string' ? outing.properties.EndDateTime : "";
  const shell = (outing?.properties?.Shell as any)?.name || "No Shell Assigned";

  // Get bank rider member name - the API returns arrays directly for relation properties
  const bankRiderId = Array.isArray(outing?.properties?.CoachBankRider) && outing.properties.CoachBankRider.length > 0
    ? outing.properties.CoachBankRider[0]?.id
    : null;
  const bankRiderMember = bankRiderId ? members.find(m => m.id === bankRiderId) : null;
  const bankRider = bankRiderMember?.name || "None";  const seatLabels = [
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

  React.useEffect(() => {
    const initialAssignments: Record<string, string> = {};
    seatLabels.forEach((seat) => {
      const seatProp = getOutingProperty(seat);
      // The API returns arrays directly for relation properties, not {relation: [...]}
      if (Array.isArray(seatProp) && seatProp.length > 0) {
        const relatedId = seatProp[0]?.id;
        const matchedMember = members.find((m) => m.id === relatedId);
        if (matchedMember) {
          initialAssignments[seat] = matchedMember.name;
        }
      }
    });

    const isSame = Object.keys(initialAssignments).every((key) => {
      return assignments[key] === initialAssignments[key];
    });

    if (!isSame) {
      setAssignments(initialAssignments);
    }
  }, [outing, members]);

  const handleAssignmentChange = async (seat: string, memberName: string) => {
    const prevMemberName = assignments[seat] || "";
    const member = members.find((m) => m.name === memberName) || null;

    console.log(`🔄 Assignment change for ${seat}: "${prevMemberName}" → "${memberName}"`);

    // Update local state
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

      if (!res.ok) throw new Error("Failed to update Notion");
      console.log(
        member
          ? `✅ Seat ${seat} updated with ${memberName}`
          : `✅ Seat ${seat} cleared`
      );
    } catch (err) {
      console.error(`❌ Error updating seat ${seat}:`, err);
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
      } catch (err) {
        console.error(`❌ Error resetting ${statusField}:`, err);
      }
    }
  };

  const handleAvailabilityUpdate = async (seat: string, status: string) => {
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
        <h3 className="text-xl font-bold text-gray-800">{title}</h3>
        <p className="text-sm text-gray-600">{startTime} – {endTime}</p>
        <p className="text-sm text-gray-600">Shell: {shell}</p>
        <p className="text-sm text-gray-600">Bank Rider: {bankRider}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {seatLabels.map((seat, idx) => {
          const allKeys = Object.keys(outing?.properties || {});
          console.log(`Checking seat: ${seat}`);
          console.log("Available property keys:", allKeys);
          console.log(`Does outing.properties have '${seat}'?`, getOutingProperty(seat) !== undefined);

          return (
            <div key={idx} className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">{seat}</label>
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
                  className="text-xs px-2 py-1 rounded bg-green-200 hover:bg-green-300"
                  onClick={() => handleAvailabilityUpdate(seat, "Available")}
                >
                  ✅
                </button>
                <button
                  className="text-xs px-2 py-1 rounded bg-yellow-200 hover:bg-yellow-300"
                  onClick={() => handleAvailabilityUpdate(seat, "Maybe Available")}
                >
                  ❓
                </button>
                <button
                  className="text-xs px-2 py-1 rounded bg-red-200 hover:bg-red-300"
                  onClick={() => handleAvailabilityUpdate(seat, "Not Available")}
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