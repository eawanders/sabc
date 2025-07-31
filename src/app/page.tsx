'use client';
import Header from "@/components/Header";
import WeekTabs from "@/components/WeekTabs";
import OutingCard from "@/components/OutingCard";
import { Outing } from "@/types/outing";
import { Member } from "@/types/members";
import { useEffect, useState, useCallback } from "react";

export default function Page() {
  const [outings, setOutings] = useState<Outing[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedWeek, setSelectedWeek] = useState("Week 1");
  const [refreshKey, setRefreshKey] = useState(0);

  // FIXED: Callback to refresh data when components make changes
  const handleStateChange = useCallback(() => {
    console.log("🔄 State change detected, refreshing data...");
    setRefreshKey(prev => prev + 1);
  }, []);

  // FIXED: Force refresh when week changes to ensure state persistence
  const handleWeekChange = (week: string) => {
    console.log(`🔄 Changing week from ${selectedWeek} to ${week}`);
    setSelectedWeek(week);
    // Don't force refresh on week change, just filter
  };

  useEffect(() => {
    console.log("🚀 useEffect executing...");

    const fetchData = async () => {
      try {
        console.log("🔍 Starting outings fetch...");
        const outingsResponse = await fetch("/api/get-outings");
        console.log("🔍 Outings response received:", outingsResponse.status);

        if (!outingsResponse.ok) {
          throw new Error(`HTTP error! status: ${outingsResponse.status}`);
        }

        const outingsData = await outingsResponse.json();
        console.log("🔍 Outings data parsed:", outingsData);
        console.log("🔍 Outings array length:", outingsData.outings?.length);

        if (outingsData.outings && Array.isArray(outingsData.outings)) {
          console.log("🔍 Setting outings to state...");
          setOutings(outingsData.outings);
          console.log("🔍 Outings set to state!");
        } else {
          console.error("❌ Invalid outings data structure");
        }

        console.log("🔍 Starting members fetch...");
        const membersResponse = await fetch("/api/get-members");
        const membersData = await membersResponse.json();
        console.log("🔍 Members data:", membersData);

        if (membersData.members) {
          setMembers(membersData.members);
        }

      } catch (error) {
        console.error("❌ Fetch error:", error);
      }
    };

    fetchData();
  }, [refreshKey]); // FIXED: Re-fetch data when refreshKey changes to get latest state

  const weeks = Array.from(
    new Set(
      outings
        .filter(o => {
          console.log("Checking outing:", o?.id, "PublishOuting:", o?.properties?.PublishOuting);
          return o?.properties?.PublishOuting?.checkbox === true;
        }) // Only include published outings
        .map((o) => o?.properties?.Week?.select?.name)
        .filter((name): name is string => Boolean(name))
    )
  );

  const filtered = outings.filter(
    o => o?.properties?.PublishOuting?.checkbox === true && // Only show published outings
         o?.properties?.Week?.select?.name === selectedWeek
  );

  console.log("=== STATE DEBUG ===");
  console.log("Total outings:", outings.length);
  console.log("Outings array:", outings);
  console.log("Published outings:", outings.filter(o => o?.properties?.PublishOuting?.checkbox === true).length);
  console.log("Weeks:", weeks);
  console.log("Selected week:", selectedWeek);
  console.log("Filtered outings:", filtered.length);
  console.log("Filtered array:", filtered);

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-start p-4 sm:p-6 md:p-10">
      <Header />
      <section id="outings" className="w-full max-w-6xl mt-12">
        <WeekTabs
          selectedWeek={selectedWeek}
          onChange={handleWeekChange}
          weeks={weeks}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {filtered.map((outing) => (
            <OutingCard
              key={`${outing.id}-${selectedWeek}-${refreshKey}`}
              outing={outing}
              members={members}
              onStateChange={handleStateChange}
            />
          ))}
        </div>
      </section>
    </main>
  );
}