// src/components/test/TestDrawer.tsx

"use client";

import React, { useState, useEffect } from 'react';
import { useTestDetails } from '@/hooks/useTestDetails';
import { useMembers } from '@/hooks/useMembers';
import Select from 'react-select';
import { Member } from '@/types/members';
import { Test, TestOutcome } from '@/types/test';
import Sheet from '@/components/ui/Sheet';
import ActionButton from '@/components/ui/ActionButton';
import { formatTimeRange } from '@/lib/date';

// Custom DropdownIndicator for react-select with thinner arrow
import { components, DropdownIndicatorProps, GroupBase } from 'react-select';

const DropdownIndicator = (
  props: DropdownIndicatorProps<
    { value: string; label: string; member: Member | null },
    false,
    GroupBase<{ value: string; label: string; member: Member | null }>
  >
) => (
  <components.DropdownIndicator {...props}>
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 8L10 12L14 8" stroke="#7D8DA6" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </components.DropdownIndicator>
);

interface TestDrawerProps {
  testId: string;
  isOpen: boolean;
  onClose: () => void;
}

const slotLabels = [
  "Slot 1",
  "Slot 2",
  "Slot 3",
  "Slot 4",
  "Slot 5",
  "Slot 6"
];

export default function TestDrawer({ testId, isOpen, onClose }: TestDrawerProps) {
  const { test, loading, error, refetch } = useTestDetails(testId);
  const { members } = useMembers();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localSelections, setLocalSelections] = useState<{ [key: string]: string | null }>({});

  // Reset local selections when test changes
  useEffect(() => {
    setLocalSelections({});
  }, [testId]);

  // Handle slot assignment
  const handleSlotChange = async (slotNumber: number, memberId: string | null) => {
    if (!test) return;

    try {
      setIsSubmitting(true);

      const response = await fetch('/api/assign-test-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId: test.id, slotNumber, memberId }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || 'Failed to assign/clear slot');
      }

      // Update local state cache
      setLocalSelections(prev => ({ ...prev, [`slot${slotNumber}`]: memberId }));

      // Refetch test data to get canonical state
      refetch();
    } catch (error) {
      console.error('Error assigning/clearing slot:', error);
      alert(error instanceof Error ? error.message : 'Failed to assign/clear slot');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle outcome update
  const handleOutcomeUpdate = async (slotNumber: number, outcome: TestOutcome) => {
    if (!test) return;

    try {
      setIsSubmitting(true);

      const response = await fetch('/api/update-test-outcome', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testId: test.id,
          slotNumber,
          outcome,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update outcome');
      }

      // Refetch test data to get updated state
      refetch();

    } catch (error) {
      console.error('Error updating outcome:', error);
      alert(error instanceof Error ? error.message : 'Failed to update outcome');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Sheet isOpen={isOpen} onClose={onClose} title="Loading Test...">
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Loading test details...</div>
        </div>
      </Sheet>
    );
  }

  if (error || !test) {
    return (
      <Sheet isOpen={isOpen} onClose={onClose} title="Error">
        <div className="flex items-center justify-center py-8">
          <div className="text-destructive">{error || 'Test not found'}</div>
        </div>
      </Sheet>
    );
  }

  // Prepare member options for dropdowns
  const memberOptions = [
    { value: '', label: '-- Select Member --', member: null },
    ...members.map(member => ({
      value: member.id,
      label: member.name,
      member
    }))
  ];

  // Format test date and time
  const testDate = new Date(test.date.start);
  const testEndDate = test.date.end ? new Date(test.date.end) : testDate;
  const dateString = testDate.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const timeString = test.date.isDatetime ? formatTimeRange(testDate, testEndDate) : 'All day';

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={test.title}>
      <div className="space-y-6">
        {/* Test Details */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{test.title}</h3>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div><strong>Type:</strong> {test.type}</div>
            <div><strong>Date:</strong> {dateString}</div>
            <div><strong>Time:</strong> {timeString}</div>
            <div><strong>Available Slots:</strong> {test.availableSlots}</div>
          </div>
        </div>

        {/* Slot Assignments */}
        <div className="space-y-4">
          <h4 className="font-medium">Test Sign-ups</h4>

          {slotLabels.slice(0, test.availableSlots).map((label, index) => {
            const slotNumber = index + 1;
            const slotKey = `slot${slotNumber}` as keyof Test;
            const outcomeKey = `slot${slotNumber}Outcome` as keyof Test;

            const currentMembers = test[slotKey] as Member[] | undefined;
            const currentOutcome = test[outcomeKey] as TestOutcome | undefined;
            const selectedMember = currentMembers?.[0]; // Assuming one member per slot

            return (
              <div key={slotNumber} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{label}</span>
                  {currentOutcome && (
                    <span className={`text-xs px-2 py-1 rounded ${
                      currentOutcome === 'Passed' ? 'bg-green-100 text-green-800' :
                      currentOutcome === 'Failed' ? 'bg-red-100 text-red-800' :
                      currentOutcome === 'No Show' ? 'bg-gray-100 text-gray-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {currentOutcome}
                    </span>
                  )}
                </div>

                <Select
                  value={memberOptions.find(option => option.value === selectedMember?.id) || memberOptions[0]}
                  onChange={(selectedOption) => {
                    if (selectedOption && selectedOption.value) {
                      handleSlotChange(slotNumber, selectedOption.value);
                    }
                  }}
                  options={memberOptions}
                  isDisabled={isSubmitting}
                  components={{ DropdownIndicator }}
                  className="text-sm"
                  styles={{
                    control: (base) => ({
                      ...base,
                      minHeight: '36px',
                      fontSize: '14px'
                    }),
                    menu: (base) => ({
                      ...base,
                      fontSize: '14px'
                    })
                  }}
                />

                {/* Outcome buttons for assigned slots */}
                {selectedMember && (
                  <div className="flex gap-2 flex-wrap">
                    {(['Test Booked', 'Passed', 'Failed', 'No Show'] as TestOutcome[]).map(outcome => (
                      <button
                        key={outcome}
                        className={`px-3 py-1 text-xs rounded border transition-colors ${
                          currentOutcome === outcome
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                        onClick={() => handleOutcomeUpdate(slotNumber, outcome)}
                        disabled={isSubmitting}
                      >
                        {outcome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}