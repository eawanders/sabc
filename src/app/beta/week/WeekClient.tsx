'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { getStoredActorId } from '@/lib/live/identity';
import { SignedInAs, useIdentity } from '../_components/Identity';
import { drawerKey } from '../_lib/keyboard';
import { weekLabel } from '../_lib/time';
import { MyOutingRow, scheduleHref } from './MyOutingRow';
import { useMyOutings } from './useMyOutings';
import { useNow } from './useNow';

export function WeekClient(props: { next: boolean; monday: string; from: string; to: string }) {
  const { openPicker, pickerOpen } = useIdentity();
  const { actorId, rows, loadState, saved, reply, undo, undoLast } = useMyOutings(props.from, props.to);
  const now = useNow();
  const router = useRouter();
  const [focus, setFocus] = useState(-1);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Not signed in on this device: ask "Who are you?" straight away
  useEffect(() => {
    if (!getStoredActorId()) openPicker();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  // Keyboard: J/K or arrows move, 1/2/3 reply, Enter opens the outing, ⌘Z undoes your last reply
  const stateRef = useRef({ rows, focus, now });
  stateRef.current = { rows, focus, now };
  useEffect(() => {
    if (pickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const { rows, focus, now } = stateRef.current;
      const intent = drawerKey(
        { key: e.key, meta: e.metaKey, ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey },
        { focus: Math.max(0, focus), count: rows.length, filled: () => focus >= 0 },
      );
      if (!intent || intent.type === 'close' || intent.type === 'clear') return;
      if (intent.type === 'undo') {
        e.preventDefault();
        undoLast();
        return;
      }
      if (rows.length === 0) return;
      if (intent.type === 'focus') {
        e.preventDefault();
        const index = focus < 0 ? 0 : intent.index;
        setFocus(index);
        rowRefs.current[index]?.focus();
        rowRefs.current[index]?.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (focus < 0) return;
      const item = rows[focus];
      if (intent.type === 'open-picker') {
        // Enter on the row itself opens the outing; Enter on a button keeps its own meaning
        if (t?.tagName === 'BUTTON' || t?.tagName === 'A') return;
        e.preventDefault();
        router.push(scheduleHref(item.outing.id, item.outing.start_at));
        return;
      }
      if (intent.type === 'set-status') {
        const end = item.outing.end_at ?? item.outing.start_at!;
        if (new Date(end).getTime() < now) return;
        e.preventDefault();
        void reply(item.outing.id, item.seat, intent.status);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickerOpen, reply, router, undoLast]);

  useEffect(() => {
    if (focus >= rows.length) setFocus(rows.length - 1);
  }, [focus, rows.length]);

  return (
    <div className="b-page w-page">
      <header className="b-top">
        <div>
          <h1>
            My week<span className="b-tag">Beta</span>
          </h1>
          <div className="sub">
            {weekLabel(props.monday)}
            {actorId && rows.length > 0 && ` · ${rows.length} ${rows.length === 1 ? 'seat' : 'seats'}`}
          </div>
        </div>
        <div className="w-toggle" role="group" aria-label="Week">
          <Link href="/beta/week" aria-pressed={!props.next} aria-current={!props.next ? 'page' : undefined}>
            This week
          </Link>
          <Link href="/beta/week?week=next" aria-pressed={props.next} aria-current={props.next ? 'page' : undefined}>
            Next week
          </Link>
        </div>
      </header>

      <div className="w-me">
        <SignedInAs />
      </div>

      <div className="b-list w-list">
        {!actorId ? (
          <div className="b-empty">
            Choose your name to see your outings and reply.
            <div style={{ marginTop: 10 }}>
              <button type="button" className="b-btn" onClick={openPicker}>
                Who are you?
              </button>
            </div>
          </div>
        ) : loadState === 'error' ? (
          <div className="b-empty">Couldn&apos;t load your outings. Refresh to try again.</div>
        ) : loadState !== 'ready' ? (
          <div className="b-empty">Loading your outings…</div>
        ) : rows.length === 0 ? (
          <div className="b-empty">
            No outings {props.next ? 'next week' : 'this week'}.{' '}
            <Link className="b-link" href={props.next ? `/beta/schedule?week=${props.monday}` : '/beta/schedule'}>
              Find one in the schedule
            </Link>
          </div>
        ) : (
          rows.map((item, i) => (
            <MyOutingRow
              key={item.key}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              item={item}
              now={now}
              saved={saved[item.key]}
              focused={i === focus}
              onFocus={() => setFocus(i)}
              onReply={(status) => void reply(item.outing.id, item.seat, status)}
              onUndo={(id) => void undo(id)}
            />
          ))
        )}
      </div>
      {actorId && rows.length > 0 && (
        <div className="b-keys w-keys">
          <span>
            <kbd>J</kbd> <kbd>K</kbd> move
          </span>
          <span>
            <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> available · maybe · can&apos;t
          </span>
          <span>
            <kbd>↵</kbd> open outing
          </span>
          <span>
            <kbd>⌘Z</kbd> undo
          </span>
        </div>
      )}
    </div>
  );
}
