"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import CalendarHeader from './CalendarHeader'
import { useMembers } from '@/hooks/useMembers'
import { useCoxingAvailability } from '../(app shell)/hooks/useCoxingAvailability'
import { useUpdateCoxingAvailability } from '../(app shell)/hooks/useUpdateCoxingAvailability'
import { useCoxingUrlState } from '@/hooks/useUrlState'
import { Member } from '@/types/members'
import { CoxingAvailability } from '@/types/coxing'
import { WeekRange } from '@/types/calendar'
import { getWeekDays, getWeekStart, getWeekEnd, formatWeekRange } from '@/lib/date'
import MembershipSignUp from '@/components/MembershipSignUp'

type TimeSlotKey = 'earlyAM' | 'midAM' | 'midPM' | 'latePM'

const TIME_SLOTS: { key: TimeSlotKey; label: string }[] = [
  { key: 'earlyAM', label: 'Before 8AM' },
  { key: 'midAM', label: '8AM - 12PM' },
  { key: 'midPM', label: '12PM - 5PM' },
  { key: 'latePM', label: 'After 5PM' },
]

export default function CoxingPageClient() {
  const router = useRouter()
  const pathname = usePathname()
  const { urlState, setDate, setMember } = useCoxingUrlState()
  const { members, refresh: refreshMembers } = useMembers()
  const currentWeek = useMemo<WeekRange>(() => {
    const weekStart = getWeekStart(urlState.date)
    const weekEnd = getWeekEnd(urlState.date)

    return {
      start: weekStart,
      end: weekEnd,
      weekLabel: formatWeekRange(weekStart, weekEnd),
      year: weekEnd.getFullYear(),
      weekNumber: getWeekNumber(weekStart),
    }
  }, [urlState.date])

  const formatLocalDate = useCallback((d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }, [])

  const weekStartStr = useMemo(() => formatLocalDate(currentWeek.start), [currentWeek, formatLocalDate])
  const weekEndStr = useMemo(() => formatLocalDate(currentWeek.end), [currentWeek, formatLocalDate])

  const { availability, setAvailability } = useCoxingAvailability(weekStartStr, weekEndStr)
  const { updateAvailability, updating } = useUpdateCoxingAvailability()

  const [selectedMember, setSelectedMember] = useState<Member | null>(null)

  useEffect(() => {
    if (pathname === '/coxing') {
      router.replace('/coxing/current')
    }
  }, [pathname, router])

  useEffect(() => {
    if (!urlState.memberId) {
      setSelectedMember(null)
      return
    }
    const member = members.find(m => m.id === urlState.memberId)
    if (member) {
      setSelectedMember(member)
    } else {
      setSelectedMember(null)
    }
  }, [urlState.memberId, members])

  const goToNextWeek = useCallback(() => {
    const currentWeekStart = getWeekStart(urlState.date)
    const nextWeek = new Date(currentWeekStart.getTime() + (7 * 24 * 60 * 60 * 1000))
    setDate(nextWeek)
  }, [urlState.date, setDate])

  const goToPreviousWeek = useCallback(() => {
    const currentWeekStart = getWeekStart(urlState.date)
    const prevWeek = new Date(currentWeekStart.getTime() - (7 * 24 * 60 * 60 * 1000))
    setDate(prevWeek)
  }, [urlState.date, setDate])

  const handleMemberChange = useCallback((member: Member | null) => {
    setSelectedMember(member)
    setMember(member?.id)
  }, [setMember])

  const weekDays = useMemo(() => {
    return getWeekDays(currentWeek.start).map(d => formatLocalDate(d))
  }, [currentWeek, formatLocalDate])

  const availabilityMap = useMemo(() => {
    const map: Record<string, CoxingAvailability> = {}
    availability.forEach(a => (map[a.date] = a))
    return map
  }, [availability])

  const handleToggle = async (date: string, timeSlot: TimeSlotKey) => {
    if (!selectedMember) return

    // Optimistic update: update local state immediately
    const dateAvail = availabilityMap[date]
    const isAvailable = dateAvail?.[timeSlot]?.includes(selectedMember.id) || false
    const action = isAvailable ? 'remove' : 'add'

    // Create optimistic update
    const optimisticAvailability = availability.map(item => {
      if (item.date === date) {
        const updatedSlot = action === 'add'
          ? [...(item[timeSlot] || []), selectedMember.id]
          : (item[timeSlot] || []).filter(id => id !== selectedMember.id)
        return { ...item, [timeSlot]: updatedSlot }
      }
      return item
    })

    // Update local state optimistically
    setAvailability(optimisticAvailability)

    try {
      const res = await updateAvailability({ memberId: selectedMember.id, date, timeSlot, action })
      if (!res?.success) {
        // Revert on failure
        setAvailability(availability)
        console.error('Failed to update availability')
      }
    } catch (error) {
      // Revert on error
      setAvailability(availability)
      console.error('Error updating availability:', error)
    }
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
          onMemberChange={handleMemberChange}
          refreshMembers={refreshMembers}
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
                    gridTemplateColumns: 'auto repeat(7, 110px)',
                    gridTemplateRows: '48px repeat(4, 48px)',
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
                      <div className="text-sm font-medium text-muted-foreground" style={{ marginBottom: '12px' }}>
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

        {/* Membership Sign Up - show when no member is selected */}
        {!selectedMember && (
          <div style={{ width: '100%', marginTop: '32px' }}>
            <MembershipSignUp />
          </div>
        )}
        {updating && (
          <div className="text-center py-6" style={{ width: '100%', marginTop: '16px' }}>
            <p className="text-muted-foreground mb-2">Updating availability...</p>
          </div>
        )}
      </div>
    </div>
  )
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
