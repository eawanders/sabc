'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MarshalDay, MarshalSlot } from '@/types/marshal';
import type { Member } from '@/types/members';
import MarshalDrawer from './MarshalDrawer';

const DAY_ORDER: MarshalDay[] = ['Wed', 'Thu', 'Fri', 'Sat'];

const DAY_FULL: Record<MarshalDay, string> = {
  Wed: 'Wednesday 27 May',
  Thu: 'Thursday 28 May',
  Fri: 'Friday 29 May',
  Sat: 'Saturday 30 May',
};

const ROLE_COLORS: Record<string, string> = {
  Marshal: '#0177FB',
  Umpire: '#F97316',
  'Static Umpire': '#A855F7',
};

function formatTimeRange(start: string, end?: string) {
  const fmt = (d: Date) =>
    d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/London',
    });
  if (!end) return fmt(new Date(start));
  return `${fmt(new Date(start))}–${fmt(new Date(end))}`;
}

export default function MarshallingPageClient() {
  const [slots, setSlots] = useState<MarshalSlot[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/get-marshals', { cache: 'no-store' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load');
      setSlots(data.slots ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/get-members', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) setMembers(data.members ?? []);
    } catch (e) {
      console.error('Failed to load members', e);
    }
  }, []);

  useEffect(() => {
    loadSlots();
    loadMembers();
  }, [loadSlots, loadMembers]);

  const slotsByDay = useMemo(() => {
    const map: Record<MarshalDay, MarshalSlot[]> = { Wed: [], Thu: [], Fri: [], Sat: [] };
    for (const s of slots) {
      if (s.day && map[s.day]) map[s.day].push(s);
    }
    for (const day of DAY_ORDER) {
      map[day].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
    }
    return map;
  }, [slots]);

  const selectedSlot = useMemo(
    () => slots.find((s) => s.id === selectedId) ?? null,
    [slots, selectedId]
  );

  const counts = useMemo(() => {
    const total = slots.length;
    const filled = slots.filter((s) => Boolean(s.person)).length;
    return { total, filled };
  }, [slots]);

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        padding: '32px',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h1
          style={{
            color: '#161736',
            fontFamily: 'Gilroy',
            fontSize: '32px',
            fontWeight: 800,
            margin: 0,
          }}
        >
          Marshalling & Umpires
        </h1>
        <p style={{ color: '#425466', fontFamily: 'Gilroy', fontSize: '16px', margin: 0 }}>
          St Antony&apos;s commitments for Summer Eights 2026 (27–30 May). Click a slot to sign up
          — your name confirms the slot. Crew warnings indicate rowers who cannot take the slot
          (race time ± 1 hr overlaps the shift).
        </p>
        <p
          style={{
            color: '#64748B',
            fontFamily: 'Gilroy',
            fontSize: '13px',
            margin: '4px 0 0 0',
          }}
        >
          {loading ? 'Loading…' : `${counts.filled} / ${counts.total} filled`}
        </p>
      </header>

      {error && (
        <div
          style={{
            padding: '16px',
            borderRadius: '8px',
            background: '#FEE2E2',
            color: '#B91C1C',
          }}
        >
          Failed to load: {error}
        </div>
      )}

      {DAY_ORDER.map((day) => {
        const daySlots = slotsByDay[day];
        if (!daySlots.length) return null;
        return (
          <section key={day} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h2
              style={{
                color: '#161736',
                fontFamily: 'Gilroy',
                fontSize: '20px',
                fontWeight: 700,
                margin: 0,
                paddingBottom: '4px',
                borderBottom: '1px solid #DFE5F1',
              }}
            >
              {DAY_FULL[day]}
            </h2>
            <div style={{ display: 'grid', gap: '8px' }}>
              {daySlots.map((slot) => (
                <SlotRow
                  key={slot.id}
                  slot={slot}
                  onClick={() => setSelectedId(slot.id)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {selectedSlot && (
        <MarshalDrawer
          slot={selectedSlot}
          members={members}
          isOpen={!!selectedSlot}
          onClose={() => setSelectedId(null)}
          onChange={() => loadSlots()}
        />
      )}
    </main>
  );
}

function SlotRow({ slot, onClick }: { slot: MarshalSlot; onClick: () => void }) {
  const roleColor = slot.role ? ROLE_COLORS[slot.role] : '#0177FB';
  const filled = Boolean(slot.person);
  return (
    <button
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '140px 170px minmax(180px, 1fr) minmax(160px, 1fr) minmax(160px, 1fr)',
        gap: '12px',
        alignItems: 'center',
        background: '#FFF',
        border: '1px solid #DFE5F1',
        borderRadius: '12px',
        padding: '14px 16px',
        textAlign: 'left',
        cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        fontFamily: 'Gilroy',
        color: '#161736',
        fontSize: '14px',
      }}
    >
      <span style={{ fontWeight: 600 }}>{formatTimeRange(slot.startTime, slot.endTime)}</span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '999px',
          background: `${roleColor}15`,
          color: roleColor,
          fontWeight: 600,
          fontSize: '12px',
          width: 'fit-content',
        }}
      >
        {slot.role ?? '—'} · {slot.shift ?? ''}
      </span>
      <span style={{ color: '#425466', fontSize: '13px' }}>{slot.location ?? '—'}</span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          color: filled ? '#15803D' : '#94A3B8',
          fontWeight: filled ? 600 : 400,
          fontStyle: filled ? 'normal' : 'italic',
        }}
      >
        {filled ? (
          <>
            <span aria-hidden>✓</span>
            {slot.person!.name}
          </>
        ) : (
          'Unfilled'
        )}
      </span>
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
        {slot.clashCrews.length > 0 ? (
          slot.clashCrews.map((c) => (
            <span
              key={c}
              title="Rowers in this crew cannot take this slot"
              style={{
                padding: '2px 8px',
                borderRadius: '999px',
                background: '#FEE2E2',
                color: '#B91C1C',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              ⚠ {c}
            </span>
          ))
        ) : (
          <span style={{ color: '#94A3B8', fontSize: '12px' }}>No clashes</span>
        )}
      </span>
    </button>
  );
}
