'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import type { ClashCrew, MarshalSlot } from '@/types/marshal';
import type { Member } from '@/types/members';

interface MarshalDrawerProps {
  slot: MarshalSlot;
  members: Member[];
  isOpen: boolean;
  onClose: () => void;
  onChange: () => void;
}

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

function formatDate(start: string) {
  return new Date(start).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/London',
  });
}

export default function MarshalDrawer({
  slot,
  members,
  isOpen,
  onClose,
  onChange,
}: MarshalDrawerProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(slot.person?.id ?? null);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedMemberId(slot.person?.id ?? null);
    setQuery('');
    setError(null);
  }, [slot.id, slot.person?.id]);

  const filteredMembers = useMemo(() => {
    if (!query.trim()) return members;
    const q = query.toLowerCase();
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q)
    );
  }, [members, query]);

  async function saveAssignment(newMemberId: string | null) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/assign-marshal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId: slot.id, memberId: newMemberId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to assign');
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  async function handlePick(memberId: string | null) {
    setSelectedMemberId(memberId);
    await saveAssignment(memberId);
  }

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={slot.name}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Detail label="Date" value={formatDate(slot.startTime)} />
          <Detail label="Time" value={formatTimeRange(slot.startTime, slot.endTime)} />
          <Detail label="Role" value={`${slot.role ?? '—'} · ${slot.shift ?? ''}`} />
          <Detail label="Location" value={slot.location ?? '—'} />
        </section>

        {slot.clashCrews.length > 0 && <ClashWarning crews={slot.clashCrews} />}

        {slot.notes && (
          <div
            style={{
              padding: '12px 14px',
              background: '#F8FAFC',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#475569',
              lineHeight: 1.5,
            }}
          >
            {slot.notes}
          </div>
        )}

        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={labelStyle}>Signed up</label>
          {selectedMemberId ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: '#DCFCE7',
                border: '1px solid #86EFAC',
                borderRadius: '8px',
              }}
            >
              <span style={{ color: '#15803D', fontWeight: 600 }}>
                ✓ {members.find((m) => m.id === selectedMemberId)?.name ?? 'Confirmed'}
              </span>
              <button
                type="button"
                disabled={saving}
                onClick={() => handlePick(null)}
                style={clearBtnStyle}
              >
                Clear
              </button>
            </div>
          ) : (
            <>
              <input
                type="search"
                placeholder="Search members…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={inputStyle}
              />
              <div
                style={{
                  maxHeight: '320px',
                  overflowY: 'auto',
                  border: '1px solid #DFE5F1',
                  borderRadius: '8px',
                }}
              >
                {filteredMembers.length === 0 ? (
                  <div style={{ padding: '12px', color: '#94A3B8', fontSize: '13px' }}>
                    No matching members.
                  </div>
                ) : (
                  filteredMembers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handlePick(m.id)}
                      disabled={saving}
                      style={memberRowStyle}
                    >
                      <span style={{ fontWeight: 600 }}>{m.name}</span>
                      <span style={{ color: '#94A3B8', fontSize: '12px' }}>{m.memberType}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </section>

        {error && (
          <div
            style={{
              padding: '12px',
              borderRadius: '8px',
              background: '#FEE2E2',
              color: '#B91C1C',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        )}

        {saving && (
          <p style={{ color: '#64748B', fontSize: '13px', margin: 0 }}>Saving…</p>
        )}
      </div>
    </Sheet>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <span style={labelStyle}>{label}</span>
      <span style={{ color: '#161736', fontSize: '14px', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function ClashWarning({ crews }: { crews: ClashCrew[] }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        padding: '12px 14px',
        background: '#FEF3C7',
        border: '1px solid #FCD34D',
        borderRadius: '8px',
      }}
    >
      <span aria-hidden style={{ fontSize: '18px' }}>⚠️</span>
      <div style={{ fontSize: '13px', color: '#92400E', lineHeight: 1.5 }}>
        <strong>Crew clash:</strong> Rowers in{' '}
        {crews.map((c, i) => (
          <span key={c} style={{ fontWeight: 700 }}>
            {c}
            {i < crews.length - 1 ? ', ' : ''}
          </span>
        ))}{' '}
        cannot take this slot (race time ± 1 hr falls within the shift).
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  color: '#94A3B8',
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  border: '1px solid #DFE5F1',
  borderRadius: '8px',
  fontSize: '14px',
  fontFamily: 'Gilroy',
};

const memberRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  width: '100%',
  padding: '10px 14px',
  background: '#FFF',
  border: 'none',
  borderBottom: '1px solid #F1F5F9',
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: 'Gilroy',
  fontSize: '14px',
  color: '#161736',
};

const clearBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: '6px',
  background: '#FFF',
  border: '1px solid #86EFAC',
  color: '#15803D',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};
