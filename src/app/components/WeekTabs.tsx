// src/components/WeekTabs.tsx

interface WeekTabsProps {
  weeks: string[];
  selectedWeek: string;
  onChange: (week: string) => void;
}

export default function WeekTabs({ weeks, selectedWeek, onChange }: WeekTabsProps) {
  return (
    <div className="flex flex-wrap" style={{ gap: "8px" }}>
      {weeks.map((week) => (
        <button
          key={week}
          onClick={() => onChange(week)}
          style={{
            display: "inline-flex",
            padding: "8px 24px",
            justifyContent: "center",
            alignItems: "center",
            gap: "10px",
            borderRadius: "10px",
            border: "1px solid rgba(170, 170, 170, 0.45)",
            background: "#6F00FF",
            color: week === selectedWeek ? "#FFFFFF" : "rgba(255, 255, 255, 0.7)",
            fontWeight: 600,
            fontSize: "14px",
            fontFamily: "var(--font-inter), system-ui, sans-serif"
          }}
        >
          {week}
        </button>
      ))}
    </div>
  );
}