// src/app/(app shell)/swim-tests/TestDrawer.tsx

import React, { useState, useEffect } from 'react';
import { useMembers } from '@/hooks/useMembers';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { Member } from '@/types/members';
import { Test, TestOutcome } from '@/types/test';
import Sheet from '@/components/ui/Sheet';
import { components, DropdownIndicatorProps, GroupBase } from 'react-select';

// Custom DropdownIndicator for react-select with thinner arrow
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
  test: Test;
  isOpen: boolean;
  onClose: () => void;
  onTestUpdate?: (updatedTest: Test) => void; // Add callback to update parent state
}

// Generate slot labels based on available slots
const getSlotLabels = (availableSlots: number): string[] => {
  return Array.from({ length: availableSlots }, (_, i) => `Slot ${i + 1}`);
};

// Test Row component for individual slot assignments
interface TestRowProps {
  slot: string;
  slotNumber: number;
  selectedMember: string;
  isSubmitting: boolean;
  members: Member[];
  membersLoading: boolean;
  assignments: Record<string, string>;
  onAssignmentChange: (slot: string, memberName: string) => void;
  onOutcomeUpdate: (slot: string, outcome: string) => void;
  isLoadingStatus: boolean;
  refreshMembers: () => Promise<void>;
}

const TestRow: React.FC<TestRowProps> = ({
  slot,
  slotNumber,
  selectedMember,
  isSubmitting,
  members,
  membersLoading,
  assignments,
  onAssignmentChange,
  onOutcomeUpdate,
  isLoadingStatus,
  refreshMembers
}) => {
  const isMemberSelected = Boolean(selectedMember);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      alignSelf: 'stretch'
    }}>
      {/* 1. Slot Number */}
      <div style={{
        display: 'flex',
        width: '40px',
        padding: '8px',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '10px',
        borderRadius: '5px',
        background: '#F3F1FE',
        boxShadow: '0 9px 44px 0 rgba(174, 174, 174, 0.10)'
      }}>
        <span style={{
          color: '#6F00FF',
          fontFamily: 'Gilroy',
          fontSize: '13px',
          fontStyle: 'normal',
          fontWeight: 300,
          lineHeight: 'normal'
        }}>
          {slotNumber}
        </span>
      </div>

      {/* 2. Member Dropdown */}
      <div style={{
        display: 'flex',
        padding: '4px 10px',
        alignItems: 'center',
        gap: '10px',
        flex: '1 0 0',
        alignSelf: 'stretch',
        borderRadius: '5px',
        background: '#FFF',
        boxShadow: '0 9px 44px 0 rgba(174, 174, 174, 0.10)',
        position: 'relative'
      }}>
        {/* Custom styled select wrapper */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flex: '1 0 0',
          position: 'relative'
        }}>
          {/* Searchable member select using react-select */}
          <div style={{ flex: '1 0 0' }}>
            <CreatableSelect
              components={{ DropdownIndicator }}
              classNamePrefix="rs"
              options={(() => {
                // Base options with "Select Member"
                const baseOptions = [{ value: '', label: 'Select Member', member: null }];

                // Filter out already assigned members (except current selection)
                const assignedNames = Object.entries(assignments)
                  .filter(([key]) => key !== slot)
                  .map(([, name]) => name);

                const filteredMembers = members.filter((member) =>
                  !assignedNames.includes(member.name) || member.name === selectedMember
                );

                const memberOptions = filteredMembers.map((member) => ({ value: member.id, label: member.name, member }));

                return [
                  ...baseOptions,
                  ...memberOptions
                ];
              })()}
              value={(() => {
                if (!selectedMember) return { value: '', label: 'Select Member', member: null };

                // First try to find the selected member in the full members list
                const selectedMemberObj = members.find(m => m.name === selectedMember);
                if (selectedMemberObj) {
                  return { value: selectedMemberObj.id, label: selectedMemberObj.name, member: selectedMemberObj };
                }

                return { value: '', label: 'Select Member', member: null };
              })()}
              onChange={(option) => {
                // Fix: Handle MultiValue type from react-select
                if (option && !Array.isArray(option) && 'member' in option && option.member) {
                  onAssignmentChange(slot, option.member.name);
                } else {
                  onAssignmentChange(slot, "");
                }
              }}
              onCreateOption={async (inputValue) => {
                try {
                  const response = await fetch('/api/add-member', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name: inputValue }),
                  });

                  if (!response.ok) {
                    throw new Error('Failed to create member');
                  }

                  const data = await response.json();
                  await refreshMembers(); // Refresh the members list
                  onAssignmentChange(slot, data.member.name); // Update assignments state
                  // Return the new option for CreatableSelect
                  return { value: data.member.id, label: data.member.name, member: data.member };
                } catch (error) {
                  console.error('Error creating member:', error);
                  // Could show a toast notification here
                  return null;
                }
              }}
              isDisabled={isSubmitting || membersLoading}
              isLoading={membersLoading}
              placeholder={membersLoading ? 'Loading members...' : 'Select member'}
              formatCreateLabel={(inputValue) => `Add "${inputValue}" as new member`}
              styles={{
                control: (base, state) => ({
                  ...base,
                  backgroundColor: 'transparent',
                  color: isMemberSelected ? '#4C6FFF' : '#7D8DA6',
                  fontFamily: 'Gilroy',
                  fontSize: '13px',
                  fontWeight: isMemberSelected ? 700 : 300,
                  border: 'none',
                  boxShadow: 'none',
                  outline: 'none',
                  minHeight: '24px',
                  height: '24px',
                  padding: 0,
                  alignItems: 'center',
                  display: 'flex',
                  lineHeight: '24px',
                }),
                input: (base) => ({
                  ...base,
                  margin: 0,
                  padding: 0,
                  height: '24px',
                  fontSize: '13px',
                  lineHeight: '24px',
                  boxShadow: 'none',
                  outline: 'none',
                }),
                indicatorsContainer: (base) => ({
                  ...base,
                  height: '24px',
                  minHeight: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }),
                singleValue: (base) => ({
                  ...base,
                  color: isMemberSelected ? '#4C6FFF' : '#7D8DA6',
                  fontWeight: isMemberSelected ? 700 : 300,
                }),
                placeholder: (base) => ({
                  ...base,
                  color: '#7D8DA6',
                  fontWeight: 300,
                }),
                indicatorSeparator: (base) => ({
                  ...base,
                  display: 'none',
                }),
                menu: (base) => ({
                  ...base,
                  zIndex: 9999,
                  position: 'absolute',
                  border: 'none',
                  boxShadow: '0 4px 16px 0 rgba(174,174,174,0.10)',
                  left: 0,
                  right: 0,
                  width: '100%',
                  minWidth: '100%',
                  marginTop: '12px', // slight offset below input
                }),
                menuList: (base) => ({
                  ...base,
                  border: 'none',
                  boxShadow: 'none',
                  padding: 0,
                }),
                menuPortal: (base) => ({
                  ...base,
                  zIndex: 9999,
                }),
                option: (base, state) => {
                  const { isSelected, isFocused, data, selectProps } = state;
                  // Get the index of the current option in the options array
                  const optionList = selectProps && selectProps.options ? selectProps.options : [];
                  const index = optionList.findIndex((opt) => {
                    // Only compare if opt has value property
                    return (typeof opt === 'object' && 'value' in opt && 'value' in data)
                      ? opt.value === (data as { value: string }).value
                      : false;
                  });
                  const isFirst = index === 0;
                  const isLast = index === optionList.length - 1;
                  let borderRadius = '0px';
                  if ((isSelected || isFocused) && isFirst && isLast) {
                    borderRadius = '5px'; // Only one item
                  } else if ((isSelected || isFocused) && isFirst) {
                    borderRadius = '5px 5px 0 0';
                  } else if ((isSelected || isFocused) && isLast) {
                    borderRadius = '0 0 5px 5px';
                  }
                  return {
                    ...base,
                    backgroundColor: isSelected
                      ? '#238AFF'
                      : isFocused
                        ? '#E6F0FF'
                        : 'transparent',
                    color: isSelected
                      ? '#fff'
                      : '#4C5A6E',
                    fontFamily: 'Gilroy',
                    fontSize: '13px',
                    fontWeight: 300,
                    padding: '8px 10px',
                    borderRadius,
                    transition: 'background 0.2s',
                    cursor: 'pointer',
                  };
                },
              }}
              menuPortalTarget={typeof window !== 'undefined' ? document.body : undefined}
              filterOption={(option, inputValue) =>
                option.label.toLowerCase().includes(inputValue.toLowerCase())
              }
            />
          </div>
        </div>
      </div>

      {/* 3. Availability Buttons (Available/Not Available) */}
      <div style={{
        display: 'flex',
        gap: '4px'
      }}>
        {/* Passed Button (Check) */}
        <div
          style={{
            display: 'flex',
            width: '32px',
            height: '32px',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '10px',
            borderRadius: '5px',
            background: assignments[`${slot}_outcome`] === "Passed" ? '#00C53E' : '#FFF',
            boxShadow: '0 9px 44px 0 rgba(174, 174, 174, 0.10)',
            cursor: isMemberSelected && !isLoadingStatus ? 'pointer' : 'not-allowed'
          }}
          onClick={() => {
            if (isMemberSelected && !isLoadingStatus) {
              onOutcomeUpdate(slot, "Passed");
            }
          }}
        >
          <svg width="13" height="14" viewBox="0 0 13 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M2.90259 7.40216L4.95814 9.45772L10.097 4.31883"
              stroke={
                assignments[`${slot}_outcome`] === "Passed"
                  ? "#FFFFFF"  // White when selected
                  : !isMemberSelected
                    ? "rgba(0, 197, 62, 0.5)"  // No member selected: 50% opacity
                    : "#00C53E"                // Member selected: 100% opacity
              }
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Failed Button (Cross) */}
        <div
          style={{
            display: 'flex',
            width: '32px',
            height: '32px',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '10px',
            borderRadius: '5px',
            background: assignments[`${slot}_outcome`] === "Failed" ? '#EF4444' : '#FFF',
            boxShadow: '0 9px 44px 0 rgba(174, 174, 174, 0.10)',
            cursor: isMemberSelected && !isLoadingStatus ? 'pointer' : 'not-allowed'
          }}
          onClick={() => {
            if (isMemberSelected && !isLoadingStatus) {
              onOutcomeUpdate(slot, "Failed");
            }
          }}
        >
          <svg width="13" height="14" viewBox="0 0 13 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M4.1392 9.58241L6.83334 6.88828M9.52747 4.19414L6.83334 6.88828M6.83334 6.88828L4.1392 4.19414M6.83334 6.88828L9.52747 9.58241"
              stroke={
                assignments[`${slot}_outcome`] === "Failed"
                  ? "#FFFFFF"  // White when selected
                  : !isMemberSelected
                    ? "rgba(254, 100, 112, 0.5)"  // No member selected: 50% opacity
                    : "#EF4444"                   // Member selected: 100% opacity
              }
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};



export default function TestDrawer({ test, isOpen, onClose, onTestUpdate }: TestDrawerProps) {
  const { members, loading: membersLoading, refresh: refreshMembers } = useMembers();

  // State management
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentTest, setCurrentTest] = useState<Test>(test);

  // Function to refresh test data from the database
  const refreshTestData = async () => {
    try {
      console.log('🔄 Refreshing test data for:', test.id);
      console.log('🔄 Current URL origin:', window.location.origin);

      const apiUrl = `/api/get-test?id=${test.id}`;
      console.log('🔄 Making fetch request to:', apiUrl);

      const response = await fetch(apiUrl);

      console.log('📡 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        console.error('❌ Response not OK:', response.status, response.statusText);

        // Try to get error details
        let errorText = 'Unknown error';
        try {
          const errorData = await response.json();
          console.error('❌ Error response data:', errorData);
          errorText = errorData.error || errorData.message || 'Failed to fetch updated test data';
        } catch (parseError) {
          console.error('❌ Failed to parse error response:', parseError);
          const textResponse = await response.text();
          console.error('❌ Raw error response:', textResponse);
          errorText = textResponse || 'Failed to fetch updated test data';
        }

        throw new Error(errorText);
      }

      console.log('📡 Parsing response JSON...');
      const data = await response.json();
      console.log('📡 Response data received:', {
        success: data.success,
        hasTest: !!data.test,
        testId: data.test?.id,
        error: data.error
      });

      if (data.success && data.test) {
        console.log('✅ Successfully refreshed test data');
        console.log('✅ Updated test object:', data.test);
        setCurrentTest(data.test);
        if (onTestUpdate) {
          onTestUpdate(data.test);
        }
        return data.test;
      } else {
        console.error('❌ API response indicates failure:', data);
        throw new Error(data.error || 'Failed to refresh test data');
      }
    } catch (error) {
      console.error('❌ Error refreshing test data:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      // Continue with existing test data on error
      return test;
    }
  };  const slotLabels = getSlotLabels(currentTest.availableSlots);

  // Safe date access
  const getDateString = () => {
    if (currentTest.date?.start) {
      return currentTest.date.start;
    }
    // Fallback for different data structures
    const testAny = currentTest as any;
    if (testAny.startTime) {
      return typeof testAny.startTime === 'string' ? testAny.startTime : testAny.startTime.toISOString();
    }
    return undefined;
  };

  const dateString = getDateString();

  // Refresh test data when drawer opens
  useEffect(() => {
    console.log('🔄 useEffect triggered - isOpen:', isOpen);
    if (isOpen) {
      console.log('🔄 Conditions met - calling refreshTestData()');
      refreshTestData();
    } else {
      console.log('🔄 Conditions not met - skipping refresh');
    }
  }, [isOpen]);

  // Initialize assignments based on existing test data
  useEffect(() => {
    if (currentTest && (isOpen || !isInitialized)) {
      const initialAssignments: Record<string, string> = {};

      // Initialize slots with existing data
      for (let i = 1; i <= currentTest.availableSlots; i++) {
        const slotKey = `slot${i}` as keyof Test;
        const outcomeKey = `slot${i}Outcome` as keyof Test;
        const slotMembers = currentTest[slotKey] as Member[] | undefined;
        const slotOutcome = currentTest[outcomeKey] as string | undefined;

        if (slotMembers && slotMembers.length > 0) {
          initialAssignments[`Slot ${i}`] = slotMembers[0].name;
        }

        // Initialize outcome if it exists
        if (slotOutcome) {
          initialAssignments[`Slot ${i}_outcome`] = slotOutcome;
        }
      }

      setAssignments(initialAssignments);
      setIsInitialized(true);
    }
  }, [currentTest, isOpen]);

  const handleAssignmentChange = async (slot: string, memberName: string) => {
    // Optimistic update: prepare previous state for potential rollback
    const previousAssignments = { ...assignments };

    // Update local state immediately for better UX
    setAssignments(prev => ({
      ...prev,
      [slot]: memberName,
      // Also update the outcome to "Test Booked" when assigning a member
      [`${slot}_outcome`]: memberName ? 'Test Booked' : 'No Show'
    }));

    // Extract slot number from slot string (e.g., "Slot 1" -> 1)
    const slotNumber = parseInt(slot.replace('Slot ', ''));

    // If memberName is empty, call API to clear the slot (unassign)
    if (!memberName) {
      try {
        const response = await fetch('/api/assign-test-slot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ testId: currentTest.id, slotNumber, memberId: null }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to clear assignment');
        }

        // Also explicitly set the outcome to 'No Show' to reflect clearing.
        await fetch('/api/update-test-outcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ testId: currentTest.id, slotNumber, outcome: 'No Show' }),
        }).catch((e) => console.warn('Failed to update outcome on clear:', e));

        // Refresh test data to ensure canonical state
        await refreshTestData();
      } catch (error) {
        console.error('Error clearing assignment:', error);
        setAssignments(previousAssignments);
        alert(error instanceof Error ? error.message : 'Failed to clear assignment');
      }

      return;
    }

    // Otherwise assign/change member
    try {
      // Find the member object to get the ID
      const member = members.find(m => m.name === memberName);
      if (!member) {
        throw new Error(`Member not found: ${memberName}`);
      }

      const response = await fetch('/api/assign-test-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId: currentTest.id, slotNumber, memberId: member.id }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to assign member to test slot');
      }

      // After successful member assignment, attempt to set the outcome to "Test Booked" (best-effort)
      const outcomeRes = await fetch('/api/update-test-outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId: currentTest.id, slotNumber, outcome: 'Test Booked' }),
      });

      if (!outcomeRes.ok) {
        console.warn('Member assigned but failed to set outcome to Test Booked');
      }

      // Refresh test data to ensure canonical state
      await refreshTestData();
    } catch (error) {
      console.error('Error assigning member to test slot:', error);
      // Revert on error
      setAssignments(previousAssignments);
      alert(error instanceof Error ? error.message : 'Failed to assign member to test slot');
    }
  };

  const handleAvailabilityUpdate = async (slot: string, outcome: string) => {
    setIsLoadingStatus(true);

    try {
      // Update local state immediately for better UX
      setAssignments(prev => ({
        ...prev,
        [`${slot}_outcome`]: outcome
      }));

      // Extract slot number from slot string (e.g., "Slot 1" -> 1)
      const slotNumber = parseInt(slot.replace('Slot ', ''));      // Make API call to update the test outcome
      const response = await fetch('/api/update-test-outcome', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testId: currentTest.id,
          slotNumber,
          outcome,
        }),
      });

      console.log(`📡 API response received:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`API Error updating outcome:`, errorData);
        throw new Error(errorData.error || 'Failed to update test outcome');
      }

    } catch (error) {
      console.error('Error updating test outcome:', error);

      // Revert the optimistic update on error
      setAssignments(prev => ({
        ...prev,
        [`${slot}_outcome`]: prev[`${slot}_outcome`]
      }));

      alert(error instanceof Error ? error.message : 'Failed to update test outcome');
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);

    try {
      // Get members data for ID lookups
      const memberLookup = new Map(members.map(m => [m.name, m]));

      // Process each slot assignment
      for (let i = 1; i <= test.availableSlots; i++) {
        const slotKey = `Slot ${i}`;
        const memberName = assignments[slotKey];
        // Use overwrite semantics: if memberName is falsy, clear the slot. Otherwise assign by member ID.
        const member = memberName ? memberLookup.get(memberName) : null;

        const body = {
          testId: test.id,
          slotNumber: i,
          memberId: member ? member.id : null,
        };

        try {
          const response = await fetch('/api/assign-test-slot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.error(`Failed to assign/clear slot ${i}:`, err);
          }
        } catch (err) {
          console.error(`Network error assigning/clearing slot ${i}:`, err);
        }
      }

      console.log('✅ All assignments saved successfully');
      // Refresh the canonical test state and close the drawer
      await refreshTestData();
      onClose();

    } catch (error) {
      console.error('Error saving test assignments:', error);
      // Could show a toast notification here
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) {
      console.warn('formatDate received undefined dateStr');
      return 'Date not available';
    }

    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        console.warn('formatDate received invalid date:', dateStr);
        return 'Invalid date';
      }

      return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(date);
    } catch (error) {
      console.error('Error formatting date:', error, 'dateStr:', dateStr);
      return 'Date error';
    }
  };

  const formatDayAndTime = (dateStr: string | undefined) => {
    if (!dateStr) {
      return 'Date not available';
    }

    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }

      // Get day of week
      const dayOfWeek = new Intl.DateTimeFormat('en-US', {
        weekday: 'long'
      }).format(date);

      // Format start time in 12-hour format (e.g., 9:00 AM)
      const startTime = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(date);

      return `${dayOfWeek} ${startTime}`;
    } catch (error) {
      console.error('Error formatting day and time:', error, 'dateStr:', dateStr);
      return 'Date error';
    }
  };

  return (
    <>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <Sheet
        isOpen={isOpen}
        onClose={onClose}
      title={<span style={{fontSize: '32px', fontWeight: 700, display: 'block', color: '#27272E', fontFamily: 'Gilroy'}}>{(() => {
        const type = currentTest?.type || '';

        if (type === 'Swim Test') {
          return 'Swim Test';
        }
        if (type === 'Capsize Drill') {
          return 'Capsize Drill';
        }
        return 'Test';
      })()}</span>}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '40px',
      }}>
        {/* Metadata Section */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {/* Date and Time */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <span style={{
              color: '#4C5A6E',
              fontFamily: 'Gilroy',
              fontSize: '14px',
              fontWeight: 400,
              lineHeight: 'normal'
            }}>
              <span style={{ fontWeight: 600 }}>Date:</span> {formatDayAndTime(dateString)}
            </span>
          </div>

          {/* Notes */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <span style={{
              color: '#4C5A6E',
              fontFamily: 'Gilroy',
              fontSize: '14px',
              fontWeight: 400,
              lineHeight: 'normal'
            }}>
              <span style={{ fontWeight: 600 }}>Notes:</span> Add your name to an available slot. Mark the outcome of your test with the action buttons beside your name. If you do not provide an outcome, we will assume you did not attend.
            </span>
          </div>
        </div>

          {/* Attendees Section */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <h3 style={{
                color: '#27272E',
                fontFamily: 'Gilroy',
                fontSize: '18px',
                fontWeight: 600,
                lineHeight: 'normal',
                margin: 0
              }}>
                Attendees
              </h3>
            </div>          {/* Container for test rows */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {slotLabels.map((slot, index) => (
              <TestRow
                key={slot}
                slot={slot}
                slotNumber={index + 1}
                selectedMember={assignments[slot] || ''}
                isSubmitting={isSaving}
                members={members}
                membersLoading={membersLoading}
                assignments={assignments}
                onAssignmentChange={handleAssignmentChange}
                onOutcomeUpdate={handleAvailabilityUpdate}
                isLoadingStatus={isLoadingStatus}
                refreshMembers={refreshMembers}
              />
            ))}
          </div>

          {/* Information Section */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            marginTop: '24px'
          }}>
            <h3 style={{
              color: '#27272E',
              fontFamily: 'Gilroy',
              fontSize: '18px',
              fontWeight: 600,
              lineHeight: 'normal',
              margin: 0
            }}>
              Information
            </h3>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              {currentTest.type === 'Capsize Drill' ? (
                <>
                  {/* Where to go - Capsize Drill */}
                  <div>
                    <h4 style={{
                      color: '#27272E',
                      fontFamily: 'Gilroy',
                      fontSize: '16px',
                      fontWeight: 600,
                      lineHeight: 'normal',
                      margin: '0 0 8px 0'
                    }}>
                      Where to go
                    </h4>
                    <p style={{
                      color: '#4C5A6E',
                      fontFamily: 'Gilroy',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: '1.4',
                      margin: 0
                    }}>
                      Swim tests take place at the Rosenblatt Pool in the Iffley Road Sports Centre. Inside the lobby, look for the OURCs desk (not the main reception desk). There will be a sign on the desk saying "Capsize Drills", and someone there will be signing people in.
                    </p>
                  </div>

                  {/* When to arrive - Capsize Drill */}
                  <div>
                    <h4 style={{
                      color: '#27272E',
                      fontFamily: 'Gilroy',
                      fontSize: '16px',
                      fontWeight: 600,
                      lineHeight: 'normal',
                      margin: '0 0 8px 0'
                    }}>
                      When to arrive
                    </h4>
                    <p style={{
                      color: '#4C5A6E',
                      fontFamily: 'Gilroy',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: '1.4',
                      margin: 0
                    }}>
                      Please arrive promptly at your booked time slot.
                    </p>
                  </div>

                  {/* Test Details - Capsize Drill */}
                  <div>
                    <h4 style={{
                      color: '#27272E',
                      fontFamily: 'Gilroy',
                      fontSize: '16px',
                      fontWeight: 600,
                      lineHeight: 'normal',
                      margin: '0 0 8px 0'
                    }}>
                      Test Details
                    </h4>
                    <p style={{
                      color: '#4C5A6E',
                      fontFamily: 'Gilroy',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: '1.4',
                      margin: '0 0 8px 0'
                    }}>
                      The test tests your ability to safely capsize and then get your boat the correct way up and back to shore.
                    </p>
                    <p style={{
                      color: '#4C5A6E',
                      fontFamily: 'Gilroy',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: '1.4',
                      margin: 0
                    }}>
                      You will receive an email once you have confirmed your availability. OURC will send you a full breakdown of the test with a link to a short online test which you must take and pass beforehand.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Where to go */}
                  <div>
                    <h4 style={{
                      color: '#27272E',
                      fontFamily: 'Gilroy',
                      fontSize: '16px',
                      fontWeight: 600,
                      lineHeight: 'normal',
                      margin: '0 0 8px 0'
                    }}>
                      Where to go
                    </h4>
                    <p style={{
                      color: '#4C5A6E',
                      fontFamily: 'Gilroy',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: '1.4',
                      margin: 0
                    }}>
                      Swim tests take place at the Rosenblatt Pool in the Iffley Road Sports Centre. Inside the lobby, look for the OURCs desk (not the main reception desk). There will be a sign on the desk saying "Swim Tests", and someone there will be signing people in.
                    </p>
                  </div>

                  {/* When to arrive */}
                  <div>
                    <h4 style={{
                      color: '#27272E',
                      fontFamily: 'Gilroy',
                      fontSize: '16px',
                      fontWeight: 600,
                      lineHeight: 'normal',
                      margin: '0 0 8px 0'
                    }}>
                      When to arrive
                    </h4>
                    <p style={{
                      color: '#4C5A6E',
                      fontFamily: 'Gilroy',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: '1.4',
                      margin: 0
                    }}>
                      Please arrive promptly at your booked time slot.
                    </p>
                  </div>

                  {/* What to wear */}
                  <div>
                    <h4 style={{
                      color: '#27272E',
                      fontFamily: 'Gilroy',
                      fontSize: '16px',
                      fontWeight: 600,
                      lineHeight: 'normal',
                      margin: '0 0 8px 0'
                    }}>
                      What to wear
                    </h4>
                    <p style={{
                      color: '#4C5A6E',
                      fontFamily: 'Gilroy',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: '1.4',
                      margin: '0 0 8px 0'
                    }}>
                      You must take the swim test in clothes or sports kit:
                    </p>
                    <ul style={{
                      color: '#4C5A6E',
                      fontFamily: 'Gilroy',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: '1.4',
                      margin: '0 0 8px 0',
                      paddingLeft: '20px'
                    }}>
                      <li>A T-shirt or equivalent (no sleeveless tops).</li>
                      <li>Shorts or lycra-style leggings (not baggy).</li>
                    </ul>
                    <p style={{
                      color: '#4C5A6E',
                      fontFamily: 'Gilroy',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: '1.4',
                      margin: 0
                    }}>
                      Goggles are allowed. Swim caps that you wouldn't normally wear while rowing are not permitted.
                    </p>
                  </div>

                  {/* What to bring */}
                  <div>
                    <h4 style={{
                      color: '#27272E',
                      fontFamily: 'Gilroy',
                      fontSize: '16px',
                      fontWeight: 600,
                      lineHeight: 'normal',
                      margin: '0 0 8px 0'
                    }}>
                      What to bring
                    </h4>
                    <ul style={{
                      color: '#4C5A6E',
                      fontFamily: 'Gilroy',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: '1.4',
                      margin: 0,
                      paddingLeft: '20px'
                    }}>
                      <li>A towel.</li>
                      <li>A change of clothes for after the test.</li>
                      <li>A bag for wet clothes.</li>
                      <li>Your Bod Card (or another form of ID if you don't have one).</li>
                    </ul>
                  </div>

                  {/* What to do when you arrive */}
                  <div>
                    <h4 style={{
                      color: '#27272E',
                      fontFamily: 'Gilroy',
                      fontSize: '16px',
                      fontWeight: 600,
                      lineHeight: 'normal',
                      margin: '0 0 8px 0'
                    }}>
                      What to do when you arrive
                    </h4>
                    <p style={{
                      color: '#4C5A6E',
                      fontFamily: 'Gilroy',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: '1.4',
                      margin: '0 0 8px 0'
                    }}>
                      Before the test, you must sign in at the OURCs desk. An OURCs member (with a laptop) will record your name, college and Bod Card number.
                    </p>
                    <ul style={{
                      color: '#4C5A6E',
                      fontFamily: 'Gilroy',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: '1.4',
                      margin: '0 0 8px 0',
                      paddingLeft: '20px'
                    }}>
                      <li>This is not done at the Sports Centre reception or by swim instructors.</li>
                      <li>Look for the "Swim Tests" sign on the table.</li>
                    </ul>
                    <p style={{
                      color: '#4C5A6E',
                      fontFamily: 'Gilroy',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: '1.4',
                      margin: '0 0 8px 0'
                    }}>
                      If you don't sign in, your swim test will not be recorded.
                    </p>
                    <p style={{
                      color: '#4C5A6E',
                      fontFamily: 'Gilroy',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: '1.4',
                      margin: 0
                    }}>
                      After signing in, you will be shown a pre-test video before heading to the pool changing rooms to get changed and take the test.
                    </p>
                  </div>

                  {/* What the swim test involves */}
                  <div>
                    <h4 style={{
                      color: '#27272E',
                      fontFamily: 'Gilroy',
                      fontSize: '16px',
                      fontWeight: 600,
                      lineHeight: 'normal',
                      margin: '0 0 8px 0'
                    }}>
                      What the swim test involves
                    </h4>
                    <ul style={{
                      color: '#4C5A6E',
                      fontFamily: 'Gilroy',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: '1.4',
                      margin: 0,
                      paddingLeft: '20px'
                    }}>
                      <li>50m swimming (last 5m underwater).</li>
                      <li>2 minutes of treading water.</li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>


      </div>
    </Sheet>
    </>
  );
}