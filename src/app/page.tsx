'use client';
import Header from "@/components/Header";
import WeekTabs from "@/components/WeekTabs";
import OutingCard from "@/components/OutingCard";
import { Outing } from "@/types/outing";
import { Member } from "@/types/members";
import { useEffect, useState } from "react";

export default function Page() {
  const [outings, setOutings] = useState<Outing[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedWeek, setSelectedWeek] = useState("Week 1");

  useEffect(() => {
    console.log("Fetching data...");
    // Fetch outings
    fetch("/api/get-outings")
      .then((res) => {
        console.log("Outings response status:", res.status);
        return res.json();
      })
      .then((data) => {
        console.log("Outings received:", data);
        console.log("Data type:", typeof data);
        console.log("Data.outings:", data.outings);
        console.log("Data.outings length:", data.outings?.length);
        if (data.outings) {
          setOutings(data.outings);
        } else {
          console.error("No outings property in response");
        }
      })
      .catch(err => console.error("Error fetching outings:", err));

    // Fetch members
    fetch("/api/get-members")
      .then((res) => res.json())
      .then((data) => {
        console.log("Members received:", data);
        setMembers(data.members);
      })
      .catch(err => console.error("Error fetching members:", err));
  }, []);

  const weeks = Array.from(
    new Set(
      outings
        .filter(o => {
          console.log("Checking outing:", o?.id, "PublishOuting:", (o?.properties?.PublishOuting as any));
          return (o?.properties?.PublishOuting as any) === true;
        }) // Only include published outings
        .map((o) => (o?.properties?.Week as any)?.name)
        .filter((name): name is string => Boolean(name))
    )
  );

  const filtered = outings.filter(
    o => (o?.properties?.PublishOuting as any) === true && // Only show published outings
         (o?.properties?.Week as any)?.name === selectedWeek
  );

  console.log("=== STATE DEBUG ===");
  console.log("Total outings:", outings.length);
  console.log("Outings array:", outings);
  console.log("Published outings:", outings.filter(o => (o?.properties?.PublishOuting as any) === true).length);
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
          onChange={setSelectedWeek}
          weeks={weeks}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {filtered.map((outing) => (
            <OutingCard key={outing.id} outing={outing} members={members} />
          ))}
        </div>
      </section>
    </main>
  );
}