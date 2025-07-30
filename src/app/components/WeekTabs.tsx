// src/components/WeekTabs.tsx

interface WeekTabsProps {
  weeks: string[];
  selectedWeek: string;
  onChange: (week: string) => void;
}

export default function WeekTabs({ weeks, selectedWeek, onChange }: WeekTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 mt-6">
      {weeks.map((week) => (
        <button
          key={week}
          onClick={() => onChange(week)}
          className={`px-4 py-2 rounded-full border text-sm font-medium ${
            week === selectedWeek
              ? 'bg-yellow-400 text-black border-yellow-500'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
          }`}
        >
          {week}
        </button>
      ))}
    </div>
  );
}