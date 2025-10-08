"use client";

import React, { useState, useEffect } from 'react'
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
    <svg style={{ display: 'block' }} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 8L10 12L14 8" stroke="#7D8DA6" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </components.DropdownIndicator>
)

export default function RowerAvailabilityPage() {
  const { members } = useMembers()
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const { availability, loading, error: fetchError } = useRowerAvailability(selectedMember?.id)
  const { updateAvailability, updating, error: updateError } = useUpdateRowerAvailability()

  const [localAvailability, setLocalAvailability] = useState<RowerWeeklyAvailability | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

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
    <main style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '32px',
      padding: '24px',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      <div>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>
          Availability
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          Set your recurring weekly unavailability times (for both rowing and coxing)
        </p>
      </div>

      {/* Member Selection */}
      <div style={{ maxWidth: '400px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
          Select Member
        </label>
        <Select
          components={{ DropdownIndicator }}
          classNamePrefix="rs"
          instanceId="rower-availability-member-filter"
          isSearchable
          isClearable
          value={selectedOption}
          onChange={handleMemberChange}
          options={memberOptions}
          placeholder="Choose a member..."
          styles={{
            control: (base, state) => ({
              ...base,
              minHeight: 48,
              borderRadius: 10,
              borderColor: state.isFocused ? '#3b82f6' : '#e2e8f0',
              boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
              '&:hover': { borderColor: '#3b82f6' }
            }),
            option: (base, state) => ({
              ...base,
              backgroundColor: state.isSelected ? '#3b82f6' : state.isFocused ? '#eff6ff' : 'white',
              color: state.isSelected ? 'white' : '#1e293b',
              cursor: 'pointer'
            })
          }}
        />
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
          Loading availability...
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

      {/* Availability Form */}
      {selectedMember && localAvailability && !loading && (
        <div style={{
          background: 'rgba(246, 247, 249, 0.60)',
          borderRadius: '10px',
          padding: '32px'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {DAYS_OF_WEEK.map(day => (
              <DaySection
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

          {/* Save Button */}
          <div style={{ marginTop: '32px', display: 'flex', gap: '16px', alignItems: 'center' }}>
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
    </main>
  )
}

// Day Section Component
interface DaySectionProps {
  day: DayOfWeek
  ranges: TimeRange[]
  onAdd: () => void
  onRemove: (index: number) => void
  onTimeChange: (index: number, field: 'start' | 'end', value: string) => void
  onMarkWholeDay: () => void
}

function DaySection({ day, ranges, onAdd, onRemove, onTimeChange, onMarkWholeDay }: DaySectionProps) {
  const canAddMore = ranges.length < 3
  const isWholeDay = ranges.length === 1 && ranges[0].start === '00:00' && ranges[0].end === '23:59'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
          {DAY_LABELS[day]}
        </h3>
        <button
          onClick={onMarkWholeDay}
          disabled={isWholeDay}
          style={{
            padding: '6px 12px',
            background: isWholeDay ? '#f1f5f9' : 'white',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            color: isWholeDay ? '#94a3b8' : '#3b82f6',
            cursor: isWholeDay ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: 500,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            if (!isWholeDay) e.currentTarget.style.backgroundColor = '#f0f9ff'
          }}
          onMouseLeave={(e) => {
            if (!isWholeDay) e.currentTarget.style.backgroundColor = 'white'
          }}
        >
          {isWholeDay ? '✓ Whole day marked' : 'Mark whole day'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {ranges.length === 0 && (
          <p style={{ color: '#94a3b8', fontSize: '14px', fontStyle: 'italic' }}>
            No unavailability set
          </p>
        )}

        {ranges.map((range, index) => (
          <div key={index} style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            background: 'white',
            padding: '12px',
            borderRadius: '8px'
          }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1 }}>
              <input
                type="time"
                value={range.start}
                onChange={(e) => onTimeChange(index, 'start', e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  flex: 1
                }}
              />
              <span style={{ color: '#94a3b8' }}>to</span>
              <input
                type="time"
                value={range.end}
                onChange={(e) => onTimeChange(index, 'end', e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  flex: 1
                }}
              />
            </div>

            <button
              onClick={() => onRemove(index)}
              style={{
                padding: '8px',
                background: 'transparent',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                fontSize: '20px',
                lineHeight: 1
              }}
              aria-label="Remove time range"
            >
              ×
            </button>
          </div>
        ))}

        {canAddMore && (
          <button
            onClick={onAdd}
            style={{
              padding: '8px 16px',
              background: 'white',
              border: '1px dashed #cbd5e1',
              borderRadius: '6px',
              color: '#3b82f6',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              alignSelf: 'flex-start'
            }}
          >
            + Add Time Range
          </button>
        )}

        {!canAddMore && (
          <p style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>
            Maximum 3 time ranges per day
          </p>
        )}
      </div>
    </div>
  )
}
