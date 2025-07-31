import React from "react";

interface Member {
  id: string;
  name: string;
}

interface OutingProperty {
  relation?: { id: string }[];
  select?: { name: string };
  title?: { plain_text: string }[];
  date?: { start: string };
}

interface Outing {
  id: string;
  properties: {
    Title?: { title: { plain_text: string }[] };
    "Start Date/Time"?: { date: { start: string } };
    "End Date/Time"?: { date: { start: string } };
    Shell?: { select: { name: string } };
    "Coach/Bank Rider"?: { select: { name: string } };
  } & {
    [seat: string]: OutingProperty;
  };
}

interface OutingCardProps {
  outing: Outing;
  members: Member[];
}

export default function OutingCard({ outing, members }: OutingCardProps) {
  const [assignments, setAssignments] = React.useState<Record<string, string>>({});

  const title = outing?.properties?.Title?.title?.[0]?.plain_text || "Untitled";
  const startTime = outing?.properties?.["Start Date/Time"]?.date?.start || "";
  const endTime = outing?.properties?.["End Date/Time"]?.date?.start || "";
  const shell = outing?.properties?.Shell?.select?.name || "-";
  const bankRider = outing?.properties?.["Coach/Bank Rider"]?.select?.name || "None";

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
    "Sub 1",
    "Sub 2",
    "Sub 3",
    "Sub 4",
  ];

  React.useEffect(() => {
    const initialAssignments: Record<string, string> = {};
    seatLabels.forEach((seat) => {
      const seatProp = outing?.properties?.[seat];
      if (seatProp?.relation && seatProp.relation.length > 0) {
        const relatedId = seatProp.relation[0]?.id;
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

    // Reset availability if the assigned member changed or was cleared
    if (prevMemberName && prevMemberName !== memberName) {
      const statusField = `${seat} Status`;
      console.log(`🔁 Resetting ${statusField} to "Not Available" due to member change`);

      try {
        const res = await fetch("/api/update-availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            outingId: outing.id,
            statusField,
            status: "Not Available",
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Failed to reset availability: ${errorText}`);
        }

        console.log(`✅ ${statusField} reset to Not Available`);

        // Update local status in assignments
        setAssignments((prev) => ({
          ...prev,
          [`${seat}_status`]: "Not Available",
        }));
      } catch (err) {
        console.error(`❌ Error resetting ${statusField}:`, err);
      }
    }
  };

  const handleAvailabilityUpdate = async (seat: string, status: string) => {
    const statusField = `${seat} Status`;
    if (!outing?.properties?.hasOwnProperty(statusField)) {
      console.warn(`❗ Property "${statusField}" does not exist in outing`);
      return;
    }

    try {
      console.log("🔄 Sending availability update with:", {
        outingId: outing.id,
        statusField, // make sure this is a correct Notion property name e.g., "Cox Status"
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
          console.log(`Does outing.properties have '${seat}'?`, outing?.properties?.hasOwnProperty(seat));

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