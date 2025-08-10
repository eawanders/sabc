'use client';
import Header from "@/components/Header";
import OutingFilters from "@/components/OutingFilters";
import OutingCard from "@/components/OutingCard";
import { Outing } from "@/types/outing";
import { Member } from "@/types/members";
import { useEffect, useState, useCallback } from "react";

export default function Page() {
  const [outings, setOutings] = useState<Outing[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedWeek, setSelectedWeek] = useState("All Weeks");
  const [selectedTerm, setSelectedTerm] = useState("All Terms");
  const [refreshKey, setRefreshKey] = useState(0);

  // FIXED: Callback to refresh data when components make changes
  const handleStateChange = useCallback(() => {
    console.log("🔄 State change detected, refreshing data...");
    setRefreshKey(prev => prev + 1);
  }, []);

  // Handle week change
  const handleWeekChange = (week: string) => {
    console.log(`🔄 Changing week from ${selectedWeek} to ${week}`);
    setSelectedWeek(week);
  };

  // Handle term change
  const handleTermChange = (term: string) => {
    console.log(`🔄 Changing term from ${selectedTerm} to ${term}`);
    setSelectedTerm(term);
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

          // Analyze the outings data
          const terms = new Set<string>();
          const weeks = new Set<string>();

          outingsData.outings.forEach((outing: Outing) => {
            const termValue = outing?.properties?.Term?.select?.name;
            const weekValue = outing?.properties?.Week?.select?.name;

            if (termValue) terms.add(termValue);
            if (weekValue) weeks.add(weekValue);
          });

          console.log("Terms in data:", Array.from(terms));
          console.log("Weeks in data:", Array.from(weeks));

          // Set initial selected values based on data
          if (terms.size > 0 && !terms.has(selectedTerm)) {
            setSelectedTerm(Array.from(terms)[0]);
          }

          if (weeks.size > 0 && !weeks.has(selectedWeek)) {
            setSelectedWeek(Array.from(weeks)[0]);
          }

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

  // Default terms and weeks (from screenshots)
  const allTerms = ["All Terms", "Michaelmas", "Hilary", "Trinity"];
  const allWeeks = ["All Weeks", "Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6", "Week 7", "Week 8", "Week 9", "Week 10"];

  // Extract all unique terms from outings data (including nulls)
  const allTermsInData = Array.from(
    new Set(
      outings.map((o) => o?.properties?.Term?.select?.name)
    )
  ).filter((name): name is string => Boolean(name));

  // Extract all unique weeks from outings data
  const allWeeksInData = Array.from(
    new Set(
      outings.map((o) => o?.properties?.Week?.select?.name)
    )
  ).filter((name): name is string => Boolean(name));

  // Always include "All Terms" and "All Weeks" options
  const terms = ["All Terms", ...allTermsInData.length > 0 ? allTermsInData : allTerms.slice(1)];
  const weeks = ["All Weeks", ...allWeeksInData.length > 0 ? allWeeksInData : allWeeks.slice(1)];  // If selected term isn't in the terms list, set it to the first available term
  if (!terms.includes(selectedTerm) && terms.length > 0) {
    setSelectedTerm(terms[0]);
  }

  // If selected week isn't in the weeks list, set it to the first available week
  if (!weeks.includes(selectedWeek) && weeks.length > 0) {
    setSelectedWeek(weeks[0]);
  }

  console.log("All terms from data:", allTermsInData);
  console.log("All weeks from data:", allWeeksInData);
  console.log("Terms to display:", terms);
  console.log("Weeks to display:", weeks);

  // Debug the current state
  console.log(`Current filters - Term: "${selectedTerm}", Week: "${selectedWeek}"`);
  console.log(`Published outings count: ${outings.filter(o => o?.properties?.PublishOuting?.checkbox === true).length}`);

  // Filter outings by publish status, term, and week, then sort by date
  const filtered = outings
    .filter(o => {
      try {
        // Only show published outings
        const isPublished = o?.properties?.PublishOuting?.checkbox === true;
        if (!isPublished) return false;

        // Debug outing details
        console.log(`Checking outing ${o.id}:`);
        console.log(`- Name: ${o?.properties?.Name?.title?.[0]?.plain_text || "Unnamed"}`);
        console.log(`- Week: ${o?.properties?.Week?.select?.name || "No week"}`);
        console.log(`- Term: ${o?.properties?.Term?.select?.name || "No term"}`);

        // For week matching:
        // 1. If "All Weeks" is selected, show outings from any week
        // 2. If a specific week is selected, only show outings from that week
        const outingWeek = o?.properties?.Week?.select?.name;
        const weekMatch = selectedWeek === "All Weeks" || outingWeek === selectedWeek;
        console.log(`- Week match: ${weekMatch} (selected: ${selectedWeek}, outing: ${outingWeek})`);
        if (!weekMatch) return false;

        // For term matching:
        // 1. If "All Terms" is selected, show all outings regardless of term
        // 2. If a specific term is selected, match outings with that term
        const outingTerm = o?.properties?.Term?.select?.name;
        const termMatch = selectedTerm === "All Terms" || outingTerm === selectedTerm;
        console.log(`- Term match: ${termMatch} (selected: ${selectedTerm}, outing: ${outingTerm || "null"})`);        console.log(`- Result: ${weekMatch && termMatch ? "MATCH" : "FILTERED OUT"}`);

        return weekMatch && termMatch;
      } catch (err) {
        console.error("Error filtering outing:", err);
        return false;
      }
    })
    .sort((a, b) => {
      // Get start date strings, defaulting to empty string if not available
      const aStartDate = a?.properties?.StartDateTime?.date?.start || "";
      const bStartDate = b?.properties?.StartDateTime?.date?.start || "";

      // If both have dates, compare them
      if (aStartDate && bStartDate) {
        return new Date(aStartDate).getTime() - new Date(bStartDate).getTime();
      }

      // If only one has a date, prioritize the one with a date
      if (aStartDate) return -1;
      if (bStartDate) return 1;

      // If neither has a date, maintain original order
      return 0;
    });

  console.log("=== STATE DEBUG ===");
  console.log("Total outings:", outings.length);
  console.log("Outings array:", outings);
  console.log("Published outings:", outings.filter(o => o?.properties?.PublishOuting?.checkbox === true).length);
  console.log("Terms:", terms);
  console.log("Weeks:", weeks);
  console.log("Selected term:", selectedTerm);
  console.log("Selected week:", selectedWeek);
  console.log("Filtered outings:", filtered.length);
  console.log("Filtered array:", filtered);

  return (
    <main className="min-h-screen flex flex-col items-center justify-start pt-4 pb-8" style={{ backgroundColor: "#F7F8FB" }}>
      <div className="w-full" style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
        <div className="max-w-[960px] mx-auto flex flex-col" style={{ gap: "32px" }}>
          <div className="w-full flex flex-col mt-0 p-0">
            <div className="w-full" style={{height: "24px" }}></div>
            <Header />
          </div>
          <section id="outings" className="w-full flex flex-col">
            <div className="w-full flex flex-col" style={{ gap: "32px" }}>
              <div className="w-full">
                <OutingFilters
                  selectedWeek={selectedWeek}
                  selectedTerm={selectedTerm}
                  onWeekChange={handleWeekChange}
                  onTermChange={handleTermChange}
                  availableWeeks={weeks}
                  availableTerms={terms}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center" style={{ width: "100%" }}>
                 {filtered.map((outing) => (
                  <div style={{ width: "350px" }} key={`${outing.id}-${selectedWeek}-${refreshKey}`}>
                    <OutingCard
                      outing={outing}
                      members={members}
                      onStateChange={handleStateChange}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}