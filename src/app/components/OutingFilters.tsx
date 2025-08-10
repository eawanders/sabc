'use client';
import { useState, useEffect } from 'react';
import {     Paragraph } from './ui/Text';

interface OutingFiltersProps {
  selectedWeek: string;
  selectedTerm: string;
  onWeekChange: (week: string) => void;
  onTermChange: (term: string) => void;
  availableWeeks: string[];
  availableTerms: string[];
}

export default function OutingFilters({
  selectedWeek,
  selectedTerm,
  onWeekChange,
  onTermChange,
  availableWeeks,
  availableTerms
}: OutingFiltersProps) {
  return (
    <div className="flex flex-col w-full gap-2 p-0">
      <Paragraph weight="light" color="gray" className="text-sm">
  <span className="!font-bold">Filter:</span>{' '}
  See outings by term and week to display relevant outings.
</Paragraph>

      <div className="flex flex-row w-full max-w-3xl" style={{ gap: "24px" }}>
        {/* Term Dropdown */}
        <div className="flex flex-col w-full" style={{ gap: "8px" }}>
          <div className="relative w-full">
            <select
              id="term-select"
              value={selectedTerm}
              onChange={(e) => onTermChange(e.target.value)}
              className="block w-full py-3 bg-white focus:outline-none focus:ring-1 focus:ring-purple-400 appearance-none"
              style={{
                borderRadius: "15px",
                border: "1px solid rgba(170, 170, 170, 0.45)",
                height: "60px",
                color: "#6F00FF",
                fontWeight: 500,
                fontSize: "16px",
                paddingLeft: "24px",
                paddingRight: "48px"
              }}
            >
              {availableTerms.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-purple-700">
              <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Week Dropdown */}
        <div className="flex flex-col w-full" style={{ gap: "8px" }}>
          <div className="relative w-full">
            <select
              id="week-select"
              value={selectedWeek}
              onChange={(e) => onWeekChange(e.target.value)}
              className="block w-full py-3 bg-white focus:outline-none focus:ring-1 focus:ring-purple-400 appearance-none"
              style={{
                borderRadius: "15px",
                border: "1px solid rgba(170, 170, 170, 0.45)",
                height: "60px",
                color: "#6F00FF",
                fontWeight: 500,
                fontSize: "16px",
                paddingLeft: "24px",
                paddingRight: "48px"
              }}
            >
              {availableWeeks.map((week) => (
                <option key={week} value={week}>
                  {week}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-purple-700">
              <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
