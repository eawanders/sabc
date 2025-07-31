'use client';
import Header from "@/components/Header";
import WeekTabs from "@/components/WeekTabs";
import OutingCard from "@/components/OutingCard";
import { Outing, Member } from "@/types/outing";
import { useEffect, useState } from "react";

export default function Page() {
  const [outings, setOutings] = useState<Outing[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedWeek, setSelectedWeek] = useState("Week 1");

  useEffect(() => {
    // Fetch outings
    fetch("/api/get-outings")
      .then((res) => res.json())
      .then((data) => setOutings(data));

    // Fetch members
    fetch("/api/get-members")
      .then((res) => res.json())
      .then((data) => setMembers(data.members));
  }, []);

  const weeks = Array.from(
    new Set(
      outings
        .map((o) => o?.properties?.Week?.select?.name)
        .filter((name): name is string => Boolean(name))
    )
  );

  const filtered = outings.filter(
    o => o?.properties?.Week?.select?.name === selectedWeek
  );

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