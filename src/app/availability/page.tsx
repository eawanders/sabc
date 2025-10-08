"use client";

import React, { useState, useEffect, useRef } from 'react'
import { useMembers } from '@/hooks/useMembers'
import { useRowerAvailability, getEmptyAvailability } from '@/hooks/useRowerAvailability'
import { useUpdateRowerAvailability } from '@/hooks/useUpdateRowerAvailability'
import { Member } from '@/types/members'
import {
  RowerWeeklyAvailability,
  TimeRange,
  DayOfWeek,
  DAYS_OF_WEEK,
  DAY_LABELS
} from '@/types/rowerAvailability'
import Select, { components, DropdownIndicatorProps, GroupBase } from 'react-select'

type OptionItem = { value: string; label: string; member: Member }

const DropdownIndicator = (
  props: DropdownIndicatorProps<OptionItem, false, GroupBase<OptionItem>>
) => (
  <components.DropdownIndicator {...props}>
    <svg style={{ display: 'block' }} width="25" height="25" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 8L10 12L14 8" stroke="#7D8DA6" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </components.DropdownIndicator>
)

export default function RowerAvailabilityPage() {
  const { members } = useMembers()
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const { availability, loading, error: fetchError } = useRowerAvailability(selectedMember?.id)
  const { updateAvailability, updating, error: updateError } = useUpdateRowerAvailability()
  const [isHover, setIsHover] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [localAvailability, setLocalAvailability] = useState<RowerWeeklyAvailability | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Hover tracking for member dropdown
  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      setIsHover(prev => (prev === inside ? prev : inside));
    }

    window.addEventListener('pointermove', onPointerMove);
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, []);

  // Update local state when availability loads
  useEffect(() => {
    if (availability) {
      setLocalAvailability(availability)
    } else if (selectedMember) {
      setLocalAvailability(getEmptyAvailability(selectedMember.id))
    }
  }, [availability, selectedMember])

  const handleMemberChange = (option: OptionItem | null) => {
    setSelectedMember(option?.member || null)
    setSaveSuccess(false)
  }

  const handleAddTimeRange = (day: DayOfWeek) => {
    if (!localAvailability) return

    const currentRanges = localAvailability[day]
    if (currentRanges.length >= 3) return // Max 3 ranges

    setLocalAvailability({
      ...localAvailability,
      [day]: [...currentRanges, { start: '09:00', end: '17:00' }]
    })
  }

  const handleRemoveTimeRange = (day: DayOfWeek, index: number) => {
    if (!localAvailability) return

    const currentRanges = localAvailability[day]
    setLocalAvailability({
      ...localAvailability,
      [day]: currentRanges.filter((_, i) => i !== index)
    })
  }

  const handleTimeChange = (day: DayOfWeek, index: number, field: 'start' | 'end', value: string) => {
    if (!localAvailability) return

    const currentRanges = [...localAvailability[day]]
    currentRanges[index] = {
      ...currentRanges[index],
      [field]: value
    }

    setLocalAvailability({
      ...localAvailability,
      [day]: currentRanges
    })
  }

  const handleMarkWholeDay = (day: DayOfWeek) => {
    if (!localAvailability) return

    // Set a single time range from 00:00 to 23:59 to mark the whole day as unavailable
    setLocalAvailability({
      ...localAvailability,
      [day]: [{ start: '00:00', end: '23:59' }]
    })
  }

  const handleSave = async () => {
    if (!localAvailability || !selectedMember) return

    setSaveSuccess(false)

    try {
      await updateAvailability(localAvailability)
      setSaveSuccess(true)

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('Failed to save:', err)
    }
  }

  const memberOptions = members.map(m => ({ value: m.id, label: m.name, member: m }))
  const selectedOption = selectedMember
    ? { value: selectedMember.id, label: selectedMember.name, member: selectedMember }
    : null

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '32px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <h1 className="sr-only">Availability</h1>

      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '32px',
          flexShrink: 1,
        }}
      >
        {/* Header Section - matching schedule/tests layout */}
        <div className="flex flex-col items-start w-full" style={{ gap: '40px' }}>
          {/* Title */}
          <h2 className="font-bold" style={{ fontSize: '32px' }}>Availability</h2>

          {/* Member Selection Row - matching schedule header layout */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              alignSelf: 'stretch',
              width: '100%'
            }}
          >
            {/* Left: description text */}
            <div className="text-muted-foreground" style={{ fontSize: '14px' }}>
              Set your recurring weekly unavailability times
            </div>

            {/* Right: Member dropdown aligned with calendar */}
            <div ref={wrapperRef} style={{ width: '250px' }}>
              <Select
                components={{ DropdownIndicator }}
                classNamePrefix="rs"
                instanceId="rower-availability-member-filter"
                isSearchable
                isClearable
                value={selectedOption}
                onChange={handleMemberChange}
                options={memberOptions}
                placeholder="Select member..."
                styles={{
                  control: (base) => ({
                    ...base,
                    display: 'flex',
                    flexDirection: 'row',
                    padding: '4px 0',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    gap: 0,
                    alignSelf: 'stretch',
                    background: isHover ? 'rgba(125,141,166,0.20)' : 'rgba(246,247,249,0.60)',
                    borderRadius: '10px',
                    position: 'relative',
                    border: 'none',
                    boxShadow: 'none',
                    minHeight: '36px',
                    fontSize: '14px',
                    fontFamily: 'Gilroy',
                    cursor: 'pointer',
                  }),
                  valueContainer: (base) => ({
                    ...base,
                    padding: '0 20px',
                    display: 'flex',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    width: '100%'
                  }),
                  input: (base) => ({
                    ...base,
                    margin: 0,
                    padding: 0,
                    height: '28px',
                    fontSize: '14px',
                    lineHeight: '28px',
                    boxShadow: 'none',
                    outline: 'none',
                  }),
                  indicatorsContainer: (base) => ({
                    ...base,
                    padding: 0,
                    height: '100%',
                    minHeight: '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '44px'
                  }),
                  singleValue: (base) => ({
                    ...base,
                    color: '#1e293b',
                    fontSize: '14px',
                    fontFamily: 'Gilroy',
                    margin: 0,
                    padding: 0,
                    maxWidth: 'calc(100% - 8px)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }),
                  placeholder: (base) => ({
                    ...base,
                    color: '#94a3b8',
                    fontSize: '14px',
                    fontFamily: 'Gilroy',
                    margin: 0
                  }),
                  menu: (base) => ({
                    ...base,
                    borderRadius: '10px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    overflow: 'hidden',
                    marginTop: '4px'
                  }),
                  menuList: (base) => ({
                    ...base,
                    padding: '4px',
                    maxHeight: '300px'
                  }),
                  option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isSelected ? '#3b82f6' : state.isFocused ? 'rgba(125,141,166,0.10)' : 'white',
                    color: state.isSelected ? 'white' : '#1e293b',
                    cursor: 'pointer',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '14px',
                    fontFamily: 'Gilroy',
                    transition: 'background-color 0.15s ease'
                  })
                }}
              />
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12 flex items-center justify-center" style={{ width: '100%', minHeight: '200px' }}>
            <p className="text-muted-foreground mb-2">Loading availability...</p>
          </div>
        )}

        {/* Error State */}
        {fetchError && (
          <div style={{
            padding: '16px',
            borderRadius: '8px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            border: '1px solid #fca5a5'
          }}>
            Error: {fetchError}
          </div>
        )}

        {/* Horizontal Calendar Grid - Availability Form */}
        {selectedMember && localAvailability && !loading && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '20px',
              width: '100%'
            }}
          >
            {DAYS_OF_WEEK.map(day => (
              <DayColumn
                key={day}
                day={day}
                ranges={localAvailability[day]}
                onAdd={() => handleAddTimeRange(day)}
                onRemove={(index) => handleRemoveTimeRange(day, index)}
                onTimeChange={(index, field, value) => handleTimeChange(day, index, field, value)}
                onMarkWholeDay={() => handleMarkWholeDay(day)}
              />
            ))}
          </div>
        )}

        {/* Save Button Row */}
        {selectedMember && localAvailability && !loading && (
          <div style={{ marginTop: '20px', display: 'flex', gap: '16px', alignItems: 'center', width: '100%' }}>
            <button
              onClick={handleSave}
              disabled={updating}
              style={{
                padding: '12px 24px',
                backgroundColor: updating ? '#94a3b8' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 500,
                cursor: updating ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!updating) e.currentTarget.style.backgroundColor = '#2563eb'
              }}
              onMouseLeave={(e) => {
                if (!updating) e.currentTarget.style.backgroundColor = '#3b82f6'
              }}
            >
              {updating ? 'Saving...' : 'Save Changes'}
            </button>

            {saveSuccess && (
              <span style={{ color: '#16a34a', fontWeight: 500 }}>
                ✓ Saved successfully!
              </span>
            )}

            {updateError && (
              <span style={{ color: '#dc2626', fontSize: '14px' }}>
                {updateError}
              </span>
            )}
          </div>
        )}

        {/* Empty State */}
        {!selectedMember && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#64748b'
          }}>
            <p style={{ fontSize: '16px' }}>
              Select a member above to set their availability
            </p>
          </div>
        )}
      </div>
    </main>
  )
}

// Day Column Component - Horizontal Layout
interface DayColumnProps {
  day: DayOfWeek
  ranges: TimeRange[]
  onAdd: () => void
  onRemove: (index: number) => void
  onTimeChange: (index: number, field: 'start' | 'end', value: string) => void
  onMarkWholeDay: () => void
}

function DayColumn({ day, ranges, onAdd, onRemove, onTimeChange, onMarkWholeDay }: DayColumnProps) {
  const canAddMore = ranges.length < 3
  const isWholeDay = ranges.length === 1 && ranges[0].start === '00:00' && ranges[0].end === '23:59'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        background: 'rgba(246, 247, 249, 0.60)',
        borderRadius: '10px',
        padding: '16px',
        minHeight: '400px'
      }}
    >
      {/* Day Header */}
      <div style={{ marginBottom: '8px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
          {DAY_LABELS[day]}
        </h3>
      </div>

      {/* Mark Whole Day Button */}
      <button
        onClick={onMarkWholeDay}
        disabled={isWholeDay}
        style={{
          padding: '8px 12px',
          background: isWholeDay ? '#f1f5f9' : 'white',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          color: isWholeDay ? '#94a3b8' : '#3b82f6',
          cursor: isWholeDay ? 'not-allowed' : 'pointer',
          fontSize: '11px',
          fontWeight: 500,
          transition: 'all 0.2s',
          whiteSpace: 'nowrap'
        }}
        onMouseEnter={(e) => {
          if (!isWholeDay) e.currentTarget.style.backgroundColor = '#f0f9ff'
        }}
        onMouseLeave={(e) => {
          if (!isWholeDay) e.currentTarget.style.backgroundColor = 'white'
        }}
      >
        {isWholeDay ? '✓ Whole day' : 'Mark whole day'}
      </button>

      {/* Time Ranges */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {ranges.length === 0 && (
          <p style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>
            No unavailability
          </p>
        )}

        {ranges.map((range, index) => (
          <div key={index} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            background: 'white',
            padding: '10px',
            borderRadius: '6px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Range {index + 1}</span>
              <button
                onClick={() => onRemove(index)}
                style={{
                  padding: '2px 6px',
                  background: 'transparent',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: '16px',
                  lineHeight: 1
                }}
                aria-label="Remove time range"
              >
                ×
              </button>
            </div>

            <input
              type="time"
              value={range.start}
              onChange={(e) => onTimeChange(index, 'start', e.target.value)}
              style={{
                padding: '6px 8px',
                borderRadius: '4px',
                border: '1px solid #e2e8f0',
                fontSize: '12px',
                width: '100%'
              }}
            />

            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>to</div>

            <input
              type="time"
              value={range.end}
              onChange={(e) => onTimeChange(index, 'end', e.target.value)}
              style={{
                padding: '6px 8px',
                borderRadius: '4px',
                border: '1px solid #e2e8f0',
                fontSize: '12px',
                width: '100%'
              }}
            />
          </div>
        ))}

        {/* Add Time Range Button */}
        {canAddMore && ranges.length > 0 && (
          <button
            onClick={onAdd}
            style={{
              padding: '8px 12px',
              background: 'white',
              border: '1px dashed #cbd5e1',
              borderRadius: '6px',
              color: '#3b82f6',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 500,
              marginTop: '4px'
            }}
          >
            + Add Range
          </button>
        )}

        {/* First Add Button when no ranges */}
        {canAddMore && ranges.length === 0 && (
          <button
            onClick={onAdd}
            style={{
              padding: '12px',
              background: 'white',
              border: '1px dashed #cbd5e1',
              borderRadius: '6px',
              color: '#3b82f6',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
              marginTop: '20px'
            }}
          >
            + Add Time Range
          </button>
        )}

        {!canAddMore && (
          <p style={{ color: '#94a3b8', fontSize: '10px', fontStyle: 'italic', textAlign: 'center', marginTop: '8px' }}>
            Max 3 ranges
          </p>
        )}
      </div>
    </div>
  )
}
