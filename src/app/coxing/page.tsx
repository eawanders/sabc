"use client";

import React, { useState, useMemo } from 'react'
import CalendarHeader from './CalendarHeader'
import { useMembers } from '@/hooks/useMembers'
import { useCalendarRange } from '../(app shell)/hooks/useCalendarRange'
import { useCoxingAvailability } from '../(app shell)/hooks/useCoxingAvailability'
import { useUpdateCoxingAvailability } from '../(app shell)/hooks/useUpdateCoxingAvailability'
import { Member } from '@/types/members'
import { CoxingAvailability } from '@/types/coxing'

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

  const weekDays = useMemo(() => {
    const start = currentWeek.start
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d.toISOString().split('T')[0]
    })
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

      <div style={{ marginTop: 24 }} className="bg-white rounded-xl p-6 shadow-sm">
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16 }}>
          {/* Y-axis labels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 8 }}>
            {TIME_SLOTS.map(s => (
              <div key={s.key} className="text-gray-600 font-medium" style={{ height: 72, display: 'flex', alignItems: 'center' }}>{s.label}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12 }}>
              {weekDays.map(day => (
                <div key={day} style={{ padding: 8, borderRadius: 12 }}>
                  <div className="text-center text-sm text-muted-foreground">{new Date(day).toLocaleDateString(undefined, { weekday: 'short' })}</div>
                  <div className="text-center text-xs text-muted-foreground">{new Date(day).getDate()}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12 }}>
              {weekDays.map(day => (
                <div key={day} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {TIME_SLOTS.map(slot => {
                    const dateAvail = availabilityMap[day]
                    const isAvailable = selectedMember ? (dateAvail?.[slot.key] || []).includes(selectedMember.id) : false

                    return (
                      <button
                        key={slot.key}
                        onClick={() => handleToggle(day, slot.key)}
                        disabled={!selectedMember || updating}
                        aria-pressed={isAvailable}
                        className={`rounded-lg py-3 px-4 text-sm transition-colors ${isAvailable ? 'bg-green-500 text-white' : 'bg-gray-50 border border-gray-100 text-gray-700 hover:bg-gray-100'} ${(!selectedMember || updating) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {isAvailable ? 'Available' : 'Not available'}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}