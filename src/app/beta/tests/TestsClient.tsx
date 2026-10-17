'use client';
// The dense test list plus the slot drawer. Opening a test only changes ?test= (history pushState),
// so it is instant and the URL can be shared; the type filter is client-side and kept in ?type=.
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TestSlotRow } from '@/lib/live/types';
import { toCanonicalId } from '@/lib/live/schemas';
import { isNotionPageId } from '@/app/api/_utils/schemas';
import { useIdentity } from '../_components/Identity';
import { loadMembers, type DirectoryMember } from '../_lib/directory';
import { matchesType, parseType, typeLabel, type BetaTest, type TestsType, type TestsWhen } from '../_lib/tests-data';
import { slotLabel } from '../_lib/tests-messages';
import { bookedCount, slotOf } from '../_lib/tests-state';
import { dayLabel, hhmm, londonParts } from '../_lib/time';
import { TestDrawer } from './TestDrawer';
import { useTestSlots } from './useTestSlots';

const TYPES: { value: TestsType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'swim', label: 'Swim tests' },
  { value: 'capsize', label: 'Capsize drills' },
];

export function TestsClient(props: { when: TestsWhen; tests: BetaTest[]; slots: TestSlotRow[]; error: string | null }) {
  const params = useSearchParams();
  const rawId = params.get('test');
  const openId = rawId && isNotionPageId(rawId) ? toCanonicalId(rawId) : rawId;
  const type = parseType(params.get('type'));
  const { actorId } = useIdentity();

  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [guests, setGuests] = useState<DirectoryMember[]>([]);
  useEffect(() => {
    loadMembers().then(setMembers).catch(() => {});
  }, []);
  const allMembers = useMemo(() => [...members, ...guests], [members, guests]);
  const byId = useMemo(() => new Map(allMembers.map((m) => [m.id, m])), [allMembers]);
  const memberName = useCallback((id: string | null) => (id ? byId.get(id)?.name ?? null : null), [byId]);

  const slots = useTestSlots(props.slots, memberName);
  const past = props.when === 'past';
  const now = Date.now();

  const setParam = useCallback(
    (name: string, value: string | null, push = false) => {
      const q = new URLSearchParams(params.toString());
      if (value) q.set(name, value);
      else q.delete(name);
      const qs = q.toString();
      const url = `/beta/tests${qs ? `?${qs}` : ''}`;
      if (push) window.history.pushState(null, '', url);
      else window.history.replaceState(null, '', url);
    },
    [params],
  );
  const setOpen = useCallback((id: string | null) => setParam('test', id, !(id && openId)), [setParam, openId]);

  const visible = useMemo(() => props.tests.filter((t) => matchesType(t, type)), [props.tests, type]);
  const days = useMemo(() => {
    const groups: { key: string; label: string; tests: BetaTest[] }[] = [];
    for (const t of visible) {
      const d = t.start_at ? new Date(t.start_at) : null;
      const p = d ? londonParts(d) : null;
      const key = p ? `${p.y}-${p.m}-${p.d}` : 'none';
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: d ? dayLabel(d) : 'No date', tests: [] };
        groups.push(g);
      }
      g.tests.push(t);
    }
    return groups;
  }, [visible]);

  const open = props.tests.find((t) => t.id === openId);
  const whenHref = (w: TestsWhen) => {
    const q = new URLSearchParams();
    if (w === 'past') q.set('when', 'past');
    if (type !== 'all') q.set('type', type);
    const qs = q.toString();
    return `/beta/tests${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="b-page">
      <header className="b-top">
        <div>
          <h1>
            Swim tests<span className="b-tag">Beta</span>
          </h1>
          <div className="sub">
            {past ? 'Past' : 'Upcoming'} swim tests and capsize drills
            {!props.error && ` · ${visible.length}`}
          </div>
        </div>
        <div className="b-nav bt-filters">
          <div className="bt-seg" role="group" aria-label="Type">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-pressed={type === t.value}
                onClick={() => setParam('type', t.value === 'all' ? null : t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="bt-seg" role="group" aria-label="When">
            <Link href={whenHref('upcoming')} aria-current={!past ? 'true' : undefined}>
              Upcoming
            </Link>
            <Link href={whenHref('past')} aria-current={past ? 'true' : undefined}>
              Past
            </Link>
          </div>
        </div>
      </header>

      <div className="b-list">
        {props.error && <div className="b-empty">{props.error}</div>}
        {!props.error && days.length === 0 && (
          <div className="b-empty">
            {past ? 'No past tests.' : 'No upcoming tests.'} {type !== 'all' && 'Try "All".'}
          </div>
        )}
        {days.map((g) => (
          <section key={g.key} aria-label={g.label}>
            <div className="b-day">
              <span>{g.label}</span>
              <span>{g.tests.length}</span>
            </div>
            {g.tests.map((t) => {
              const { booked, capacity } = bookedCount(slots.state, t);
              const mine = slotOf(slots.state, t, actorId);
              const full = booked >= capacity;
              const started = t.start_at ? new Date(t.start_at).getTime() < now : false;
              return (
                <div key={t.id} className="bt-row" aria-current={t.id === openId}>
                  <button type="button" className="bt-open" onClick={() => setOpen(t.id)} aria-label={`${t.title}, ${booked} of ${capacity} booked`}>
                    <span className="b-mono">{when(t)}</span>
                    <span className="nm">{t.title || 'Test'}</span>
                    <span className="ty">{typeLabel(t.type)}</span>
                    <span className={`cn${full ? ' full' : ''}`} title="Slots booked">
                      {booked}/{capacity}
                    </span>
                  </button>
                  <span className="bt-act">
                    {mine ? (
                      <span className="b-st bt-mine" title={`You're in ${slotLabel(mine)}`}>
                        <span className="b-dot ok" />
                        {slotLabel(mine)}
                      </span>
                    ) : past || started ? null : full ? (
                      <span className="b-muted">Full</span>
                    ) : (
                      <button type="button" className="b-btn bt-book" onClick={() => void slots.bookMe(t)}>
                        Book me
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </section>
        ))}
      </div>

      {openId && (
        <TestDrawer
          key={openId}
          testId={openId}
          initial={open}
          slots={slots}
          members={allMembers}
          memberName={memberName}
          onGuestAdded={(m) => setGuests((g) => [...g, m])}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function when(t: BetaTest): string {
  if (!t.start_at) return '—';
  if (t.all_day) return 'All day';
  return hhmm(new Date(t.start_at));
}
