'use client';
// Test drawer (the CrewDrawer pattern): breadcrumb, properties, one dense row per slot with a
// command-palette picker and an outcome menu, "Book me", and a keyboard model (tests-keyboard.ts).
import { useEffect, useMemo, useRef, useState } from 'react';
import { addGuestMember } from '@/lib/live/members';
import { getBrowserClient } from '@/lib/live/realtime';
import { Status } from '../_components/CrewDrawer';
import { useIdentity } from '../_components/Identity';
import { useToast } from '../_components/Toasts';
import type { DirectoryMember } from '../_lib/directory';
import { loadTest, typeLabel, type BetaTest } from '../_lib/tests-data';
import { SIGNUP_NOTE, testInfo } from '../_lib/tests-info';
import { testDrawerKey } from '../_lib/tests-keyboard';
import { slotLabel } from '../_lib/tests-messages';
import { bookedCount, bookedIn, shownSlots, slotKey, slotOf, viewSlot } from '../_lib/tests-state';
import { dayLabel, hhmm } from '../_lib/time';
import { OutcomeMenu, OutcomeStatus } from './OutcomeMenu';
import { SlotPicker } from './SlotPicker';
import type { TestSlots } from './useTestSlots';

export function TestDrawer(props: {
  testId: string;
  initial?: BetaTest;
  slots: TestSlots;
  members: DirectoryMember[];
  memberName: (id: string | null) => string | null;
  onGuestAdded: (m: DirectoryMember) => void;
  onClose: () => void;
}) {
  const { slots } = props;
  const [loaded, setLoaded] = useState<BetaTest | null>(null);
  const [loadState, setLoadState] = useState<'ready' | 'loading' | 'missing' | 'error'>(props.initial ? 'ready' : 'loading');
  const test = props.initial ?? loaded;
  const [focus, setFocus] = useState(0);
  const [picker, setPicker] = useState<{ slot: number; version: number } | null>(null);
  const pickerSlot = picker?.slot ?? null;
  const [menuSlot, setMenuSlot] = useState<number | null>(null);
  const { actorId, requireActor, pickerOpen: whoOpen } = useIdentity();
  const toast = useToast();
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  // A ?test= link to a test outside the current list (e.g. a past one) loads on its own
  const { merge } = slots;
  useEffect(() => {
    if (props.initial) return;
    const client = getBrowserClient();
    if (!client) {
      setLoadState('error');
      return;
    }
    let cancelled = false;
    loadTest(client, props.testId)
      .then((r) => {
        if (cancelled) return;
        if (!r) return setLoadState('missing');
        merge(r.slots);
        setLoaded(r.test);
        setLoadState('ready');
      })
      .catch(() => !cancelled && setLoadState('error'));
    return () => {
      cancelled = true;
    };
  }, [props.initial, props.testId, merge]);

  const list = test ? shownSlots(slots.state, test) : [];
  const counts = test ? bookedCount(slots.state, test) : { booked: 0, capacity: 0 };
  const mine = test ? slotOf(slots.state, test, actorId) : null;
  const taken = useMemo(() => (test ? bookedIn(slots.state, test) : {}), [slots.state, test]);
  const start = test?.start_at ? new Date(test.start_at) : null;
  const end = test?.end_at ? new Date(test.end_at) : null;
  const canBook = Boolean(test && !mine && counts.booked < counts.capacity && (!start || start.getTime() > Date.now()));

  // Keyboard: active while no dialog or menu is open and focus isn't in a text field
  const latest = useRef({ focus, list, test, pickerSlot, menuSlot, whoOpen, slots, onClose: props.onClose });
  latest.current = { focus, list, test, pickerSlot, menuSlot, whoOpen, slots, onClose: props.onClose };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { focus, list, test, pickerSlot, menuSlot, whoOpen, slots, onClose } = latest.current;
      if (pickerSlot !== null || menuSlot !== null || whoOpen || !test) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const intent = testDrawerKey(
        { key: e.key, meta: e.metaKey, ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey },
        { focus, count: list.length, filled: (i) => Boolean(viewSlot(slots.state, test.id, list[i])?.member_id) },
      );
      if (!intent) return;
      e.preventDefault();
      switch (intent.type) {
        case 'focus':
          setFocus(intent.index);
          rowRefs.current[intent.index]?.scrollIntoView({ block: 'nearest' });
          break;
        case 'open-picker':
          openPicker(list[intent.index]);
          break;
        case 'set-outcome':
          void slots.setOutcome(test.id, list[intent.index], intent.outcome);
          break;
        case 'clear':
          void slots.assign(test.id, list[intent.index], null);
          break;
        case 'book-me':
          void slots.bookMe(test);
          break;
        case 'undo':
          slots.undoLast();
          break;
        case 'close':
          onClose();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Remember the slot's version as the picker opens: the choice is judged against what was seen then
  const openPicker = (slot: number) => {
    const { test, slots } = latest.current;
    const v = test && slots.state.rows[slotKey(test.id, slot)]?.version;
    if (v !== undefined && v !== null) setPicker({ slot, version: v });
  };

  const addGuest = async (slot: number, name: string, seenVersion: number) => {
    const actor = test && (await requireActor());
    if (!test || !actor) return;
    try {
      const r = await addGuestMember({ name, actor });
      if (!r.ok) {
        toast(`Couldn't add ${name}: ${r.reason}`, { warn: true });
        return;
      }
      props.onGuestAdded({ id: r.member.id, name: r.member.name, member_type: [] });
      await slots.assign(test.id, slot, r.member.id, { name: r.member.name, seenVersion });
    } catch {
      toast("Adding guests isn't available yet.", { warn: true });
    }
  };

  const row = (slot: number, i: number) => {
    if (!test) return null;
    const v = viewSlot(slots.state, test.id, slot);
    const key = slotKey(test.id, slot);
    const memberId = v?.member_id ?? null;
    const name = memberId ? props.memberName(memberId) ?? '…' : null;
    const pending = Boolean(slots.state.pending[key]);
    return (
      <div
        key={slot}
        ref={(el) => {
          rowRefs.current[i] = el;
        }}
        className={`b-srow bt-srow${i === focus ? ' focus' : ''}${slots.flash[key] ? ' b-flash' : ''}${pending ? ' pending' : ''}`}
        onMouseDown={() => setFocus(i)}
      >
        <span className="b-mono">{slot}</span>
        <button
          type="button"
          className={`nm${name ? '' : ' empty'}`}
          onClick={() => {
            setFocus(i);
            openPicker(slot);
          }}
          aria-label={`${slotLabel(slot)}: ${name ?? 'empty'}${memberId === actorId && name ? ' (you)' : ''}. Assign`}
        >
          {name ?? 'Assign…'}
          {memberId && memberId === actorId && <span className="bt-you">you</span>}
        </button>
        {memberId ? (
          <span className="bt-oc">
            <button
              type="button"
              className="stbtn"
              title="Outcome (1 Passed · 2 Failed · 3 No show · 4 Booked)"
              aria-haspopup="menu"
              aria-expanded={menuSlot === slot}
              onClick={() => {
                setFocus(i);
                setMenuSlot(slot);
              }}
            >
              <OutcomeStatus outcome={v?.outcome ?? null} />
            </button>
            {menuSlot === slot && (
              <OutcomeMenu
                current={v?.outcome ?? null}
                onClose={() => setMenuSlot(null)}
                onChoose={(o) => {
                  setMenuSlot(null);
                  void slots.setOutcome(test.id, slot, o);
                }}
              />
            )}
          </span>
        ) : (
          <span />
        )}
      </div>
    );
  };

  return (
    <aside className="b-drawer" role="dialog" aria-label={test?.title ?? 'Test'}>
      <div className="b-crumbs">
        <button type="button" onClick={props.onClose} className="b-muted">
          Swim tests
        </button>
        <span>/</span>
        <span>{start ? dayLabel(start) : '—'}</span>
        <span>/</span>
        <b>{test?.title || 'Test'}</b>
        <span className="sp" />
        <button type="button" className="b-icon" onClick={props.onClose} aria-label="Close (Esc)" title="Close (Esc)">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {loadState === 'loading' && <p className="b-note">Loading test…</p>}
      {loadState === 'missing' && <p className="b-note">This test no longer exists.</p>}
      {loadState === 'error' && <p className="b-note">Couldn&apos;t load this test. Check your connection and reopen it.</p>}

      {test && (
        <>
          <div className="b-doc">
            <h2>{test.title || 'Test'}</h2>
            <dl className="b-props">
              <dt>Type</dt>
              <dd>{typeLabel(test.type)}</dd>
              <dt>Time</dt>
              <dd>
                {start
                  ? `${dayLabel(start)}, ${test.all_day ? 'all day' : `${hhmm(start)}${end ? `–${hhmm(end)}` : ''}`}`
                  : '—'}
              </dd>
              <dt>Slots</dt>
              <dd>
                <Status
                  tone={counts.booked >= counts.capacity ? 'no' : 'ok'}
                  text={counts.capacity === 0 ? 'No slots' : `${counts.booked} of ${counts.capacity} booked`}
                />
              </dd>
              <dt>You</dt>
              <dd>
                {mine ? (
                  <span className="b-st">
                    <span className="b-dot ok" />
                    Booked in {slotLabel(mine)}
                  </span>
                ) : canBook ? (
                  <button type="button" className="b-btn bt-book" onClick={() => void slots.bookMe(test)}>
                    Book me <kbd>B</kbd>
                  </button>
                ) : (
                  <span className="b-muted">Not booked</span>
                )}
              </dd>
            </dl>
          </div>
          <div className="b-scroll" aria-label="Slots">
            <div className="b-group">
              <span>Slots</span>
              <span>
                {counts.booked}/{counts.capacity}
              </span>
            </div>
            {list.length === 0 && <p className="b-note">This test has no slots yet.</p>}
            {list.map(row)}
            <p className="bt-hint">{SIGNUP_NOTE}</p>
            <details className="bt-info">
              <summary>Information</summary>
              {testInfo(test.type).map((s) => (
                <section key={s.title}>
                  <h3>{s.title}</h3>
                  {s.text?.map((p) => <p key={p}>{p}</p>)}
                  {s.list && (
                    <ul>
                      {s.list.map((li) => (
                        <li key={li}>{li}</li>
                      ))}
                    </ul>
                  )}
                  {s.after?.map((p) => <p key={p}>{p}</p>)}
                </section>
              ))}
            </details>
          </div>
          <div className="b-keys" aria-hidden="true">
            <span>
              <kbd>J</kbd>
              <kbd>K</kbd> move
            </span>
            <span>
              <kbd>↵</kbd> assign
            </span>
            <span>
              <kbd>B</kbd> book me
            </span>
            <span>
              <kbd>1</kbd>–<kbd>4</kbd> outcome
            </span>
            <span>
              <kbd>⌫</kbd> clear
            </span>
            <span>
              <kbd>⌘Z</kbd> undo
            </span>
          </div>
        </>
      )}

      {picker && test && (
        <SlotPicker
          slot={picker.slot}
          members={props.members}
          taken={taken}
          current={viewSlot(slots.state, test.id, picker.slot)?.member_id ?? null}
          me={actorId}
          onClose={() => setPicker(null)}
          onChoose={(choice) => {
            const { slot, version } = picker!;
            setPicker(null);
            if (choice.kind === 'guest') void addGuest(slot, choice.name, version);
            else if (choice.memberId !== (viewSlot(slots.state, test.id, slot)?.member_id ?? null)) {
              void slots.assign(test.id, slot, choice.memberId, { seenVersion: version });
            }
          }}
        />
      )}
    </aside>
  );
}
