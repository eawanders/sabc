"use client";

import React, { useState, useMemo } from 'react'
import CalendarHeader from './CalendarHeader'
import { useMembers } from '@/hooks/useMembers'
import { useCalendarRange } from '../(app shell)/hooks/useCalendarRange'
import { useCoxingAvailability } from '../(app shell)/hooks/useCoxingAvailability'
import { useUpdateCoxingAvailability } from '../(app shell)/hooks/useUpdateCoxingAvailability'
import { Member } from '@/types/members'
import { CoxingAvailability } from '@/types/coxing'
import { getWeekDays } from '@/lib/date'

type TimeSlotKey = 'earlyAM' | 'midAM' | 'midPM' | 'latePM'

const TIME_SLOTS: { key: TimeSlotKey; label: string }[] = [
  { key: 'earlyAM', label: 'Early AM' },
  { key: 'midAM', label: 'Mid AM' },
  { key: 'midPM', label: 'Early PM' },
  { key: 'latePM', label: 'Late PM' },
]

export default function CoxingPage() {
  const { currentWeek, goToNextWeek, goToPreviousWeek } = useCalendarRange()
  const { members, loading: membersLoading } = useMembers()
  const { availability, loading: availabilityLoading, refetch } = useCoxingAvailability()
  const { updateAvailability, updating } = useUpdateCoxingAvailability()

  const [selectedMember, setSelectedMember] = useState<Member | null>(null)

  // Format date as local YYYY-MM-DD to avoid timezone shifts from toISOString()
  const formatLocalDate = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const weekDays = useMemo(() => {
    return getWeekDays(currentWeek.start).map(d => formatLocalDate(d))
  }, [currentWeek])

  const availabilityMap = useMemo(() => {
    const map: Record<string, CoxingAvailability> = {}
    availability.forEach(a => (map[a.date] = a))
    return map
  }, [availability])

  const handleToggle = async (date: string, timeSlot: TimeSlotKey) => {
    if (!selectedMember) return
    const dateAvail = availabilityMap[date]
    const isAvailable = dateAvail?.[timeSlot]?.includes(selectedMember.id) || false
    const action = isAvailable ? 'remove' : 'add'

    const res = await updateAvailability({ memberId: selectedMember.id, date, timeSlot: timeSlot as any, action })
    if (res?.success) refetch()
  }

  return (
    <div className="p-6">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'flex-start' }}>
        <CalendarHeader
          currentWeek={currentWeek}
          onPreviousWeek={goToPreviousWeek}
          onNextWeek={goToNextWeek}
          members={members}
          selectedMember={selectedMember}
          onMemberChange={setSelectedMember}
        />
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
          {/* Calendar grid (contains an internal labels column to the left of days) */}
          <div>
            {/* Calendar background with internal grid: labels column + 7 day columns and rows for header + time slots */}
            <div
              style={{
                padding: '32px',
                borderRadius: '10px',
                background: 'rgba(246, 247, 249, 0.60)',
                minHeight: '273px',
                width: '100%'
              }}
            >
              {/* centered inner wrapper matches /schedule: keeps background full width but centers content */}
              <div style={{ maxWidth: '1140px', margin: '0 auto' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '160px repeat(7, 110px)',
                    gridTemplateRows: '48px repeat(4, 72px)',
                    columnGap: '24px',
                    rowGap: '24px',
                    alignItems: 'center'
                  }}
                >
                  {/* top-left spacer */}
                  <div style={{ gridColumn: '1', gridRow: '1' }} />

                  {/* Day headers (columns 2..8) */}
                  {weekDays.map((day, idx) => (
                    <div key={day} style={{ textAlign: 'center', gridColumn: `${idx + 2}`, gridRow: '1' }}>
                      <div className="text-sm font-medium text-muted-foreground">
                        {new Date(day).toLocaleDateString(undefined, { weekday: 'short' })}
                      </div>
                      <div className="text-lg font-semibold text-foreground">
                        {new Date(day).getDate().toString().padStart(2, '0')}
                      </div>
                    </div>
                  ))}

                  {/* Labels column (rows 2..5 in column 1) */}
                  {TIME_SLOTS.map((s, idx) => (
                    <div
                      key={`label-${s.key}`}
                      style={{ display: 'flex', alignItems: 'center', paddingLeft: '8px', gridColumn: '1', gridRow: `${idx + 2}` }}
                      className="text-gray-600 font-medium"
                    >
                      {s.label}
                    </div>
                  ))}

                  {/* Availability buttons for each day/time slot placed into grid cells */}
                  {TIME_SLOTS.map((slot, rowIdx) => (
                    weekDays.map((day, colIdx) => {
                      const dateAvail = availabilityMap[day]
                      const isAvailable = selectedMember ? (dateAvail?.[slot.key] || []).includes(selectedMember.id) : false
                      return (
                        <div
                          key={`${day}-${slot.key}`}
                          style={{ width: '100%', display: 'flex', justifyContent: 'center', gridColumn: `${colIdx + 2}`, gridRow: `${rowIdx + 2}` }}
                        >
                          <button
                            onClick={() => handleToggle(day, slot.key)}
                            disabled={!selectedMember || updating}
                            aria-pressed={isAvailable}
                              style={{
                                display: 'flex',
                                height: '28px',
                                width: '100%',
                                padding: '5px 20px',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '10px',
                                flexShrink: 0,
                                alignSelf: 'stretch',
                                borderRadius: '5px',
                                background: isAvailable ? 'rgb(0, 197, 62)' : '#FFFFFF',
                                color: isAvailable ? '#FFFFFF' : '#4C5A6E',
                                boxShadow: '0 9px 44px 0 rgba(174, 174, 174, 0.20)',
                                border: 'none',
                                cursor: (!selectedMember || updating) ? 'not-allowed' : 'pointer',
                                opacity: !selectedMember ? 0.5 : 1,
                                fontFamily: 'Gilroy',
                                fontSize: '14px',
                                fontWeight: 300,
                                lineHeight: '20px'
                              }}
                          >
                            {isAvailable ? 'Available' : 'Unavailable'}
                          </button>
                        </div>
                      )
                    })
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* No member selected message (matches schedule empty-state styling) */}
        {!selectedMember && (
          <div className="text-center py-6" style={{ width: '100%', marginTop: '32px' }}>
            <p className="text-muted-foreground mb-2">No cox is selected. Select a cox to provide availability.</p>
          </div>
        )}
      </div>
    </div>
  )
}