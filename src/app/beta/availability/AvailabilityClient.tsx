'use client';
// Weekly unavailability editor: you by default, anyone via "Edit someone else" (?member=), a dense
// seven-day grid on desktop and one day at a time on phones. Reads with the anon key + Realtime;
// saves through /api/live/unavailability with the version on screen, so a save never lands over
// someone else's newer one. Undo (toast or ⌘Z) reverts your last save.
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { getBrowserClient, subscribeToTable } from '@/lib/live/realtime';
import { saveUnavailability, undoChange } from '@/lib/live/write';
import { toCanonicalId } from '@/lib/live/schemas';
import type { UnavailabilityRow } from '@/lib/live/types';
import { isNotionPageId } from '@/app/api/_utils/schemas';
import { DAYS_OF_WEEK, DAY_LABELS, DAY_LABELS_SHORT, type DayOfWeek, type TimeRange } from '@/types/rowerAvailability';
import { useIdentity } from '../_components/Identity';
import { useToast } from '../_components/Toasts';
import { applyUnavailabilityRow } from '../_lib/availability-live';
import {
  MAX_RANGES,
  PRESETS,
  WHOLE_DAY,
  canAdd,
  canEdit as canEditState,
  dayError,
  editorReducer,
  initialEditor,
  isDirty,
  isWholeDay,
  nextRange,
  rangeIssue,
  sortRanges,
  swipeStep,
  weekEffect,
  weekIsValid,
} from '../_lib/availability-edit';
import type { DirectoryMember } from '../_lib/directory';
import { dayLabel, hhmm, londonParts, shortDay } from '../_lib/time';
import type { WeekOuting } from '../_lib/week';
import { MemberSwitcher } from './MemberSwitcher';
import './availability.css';

type Undoable = { changeId: number; memberId: string };

export function AvailabilityClient(props: { members: DirectoryMember[]; outings: WeekOuting[] | null; error: string | null }) {
  const params = useSearchParams();
  const { actorId, requireActor, openPicker } = useIdentity();
  const toast = useToast();
  const [state, dispatch] = useReducer(editorReducer, initialEditor);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [booted, setBooted] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [dayIdx, setDayIdx] = useState(() => DAYS_OF_WEEK.indexOf(londonParts(new Date()).weekday));
  const undoStack = useRef<Undoable[]>([]);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const byId = useMemo(() => new Map(props.members.map((m) => [m.id, m])), [props.members]);
  const nameOf = useCallback((id: string | null | undefined) => (id ? byId.get(id)?.name ?? null : null), [byId]);

  // The member being edited: ?member= if it names a member, otherwise you
  const raw = params.get('member');
  const override = raw && isNotionPageId(raw) && byId.has(toCanonicalId(raw)) ? toCanonicalId(raw) : null;
  const targetId = override ?? actorId;
  const isSelf = !!targetId && targetId === actorId;

  // The identity is read from storage in an effect; wait one render so "Who are you?" doesn't flash
  useEffect(() => setBooted(true), []);

  useEffect(() => {
    if (booted) dispatch({ type: 'select', memberId: targetId });
  }, [booted, targetId]);

  // Load the selected member's row whenever the editor asks for it (selection, conflict, retry)
  useEffect(() => {
    const memberId = state.memberId;
    if (!memberId || state.load !== 'loading') return;
    const client = getBrowserClient();
    if (!client) {
      dispatch({ type: 'failed', memberId });
      return;
    }
    void (async () => {
      const { data, error } = await client.from('member_unavailability').select('*').eq('member_id', memberId).maybeSingle();
      // The reducer drops this if another member has been selected meanwhile
      if (error) dispatch({ type: 'failed', memberId });
      else dispatch({ type: 'loaded', memberId, row: (data as UnavailabilityRow | null) ?? null });
    })();
  }, [state.memberId, state.load]);

  // Realtime for the selected member, and a catch-up read when the tab comes back
  useEffect(() => {
    const memberId = state.memberId;
    if (!memberId) return;
    const off = subscribeToTable<UnavailabilityRow>(
      'member_unavailability',
      (change) => {
        if (change.new) dispatch({ type: 'remote', row: change.new });
      },
      { filter: `member_id=eq.${memberId}` },
    );
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      const client = getBrowserClient();
      const res = await client?.from('member_unavailability').select('*').eq('member_id', memberId).maybeSingle();
      if (res?.data) dispatch({ type: 'remote', row: res.data as UnavailabilityRow });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      off();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [state.memberId]);

  const editable = canEditState(state, targetId);
  const dirty = editable && isDirty(state);
  const valid = !!state.draft && weekIsValid(state.draft);

  // Leaving with unsaved edits asks first
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const setTarget = useCallback(
    (id: string | null) => {
      if (isDirty(stateRef.current) && !window.confirm('Discard your unsaved changes?')) return;
      const q = new URLSearchParams(params.toString());
      if (id && id !== actorId) q.set('member', id);
      else q.delete('member');
      const qs = q.toString();
      window.history.replaceState(null, '', `/beta/availability${qs ? `?${qs}` : ''}`);
    },
    [params, actorId],
  );

  const whose = useCallback(
    (memberId: string, actor: string | null) => (memberId === actor ? 'your' : `${nameOf(memberId) ?? 'their'}'s`),
    [nameOf],
  );

  const undoEntry = useCallback(
    async (entry: Undoable) => {
      undoStack.current = undoStack.current.filter((e) => e !== entry);
      const actor = await requireActor();
      if (!actor) return;
      const result = await undoChange({ changeId: entry.changeId, actorId: actor });
      if (result.ok) {
        const row = result.row as UnavailabilityRow;
        dispatch({ type: 'saved', memberId: row.member_id, row });
        applyUnavailabilityRow(row);
        toast(`Undone: ${whose(entry.memberId, actor)} availability is back as it was`);
      } else if (result.reason === 'conflict') {
        toast(
          result.message === 'already undone'
            ? 'Already undone.'
            : `Can't undo: ${result.updatedByName ?? 'someone'} changed it since.`,
          { warn: true },
        );
      } else {
        toast("Couldn't undo. Try again.", { warn: true });
      }
    },
    [requireActor, toast, whose],
  );

  const save = useCallback(async () => {
    const s = stateRef.current;
    if (!s.memberId || !s.base || !s.draft || s.saving || s.load !== 'ready' || !isDirty(s) || !weekIsValid(s.draft)) return;
    const { memberId, draft, base } = s;
    const actor = await requireActor();
    if (!actor) return;
    dispatch({ type: 'save-start' });
    const result = await saveUnavailability({ memberId, days: draft, actorId: actor, expectedVersion: base.version });
    if (result.ok) {
      dispatch({ type: 'saved', memberId, row: result.row });
      applyUnavailabilityRow(result.row);
      const entry = { changeId: result.changeId, memberId };
      undoStack.current.push(entry);
      setJustSaved(true);
      toast(`Saved ${whose(memberId, actor)} availability`, { onUndo: () => void undoEntry(entry) });
      return;
    }
    if (result.reason === 'conflict') {
      dispatch({ type: 'conflict', memberId, current: result.current });
      if (result.current) applyUnavailabilityRow(result.current);
      toast(
        `${result.updatedByName ?? 'Someone'} saved ${whose(memberId, actor)} availability first. Yours wasn't applied; showing theirs.`,
        { warn: true },
      );
      return;
    }
    dispatch({ type: 'save-failed' });
    toast(result.message ? `Not saved: ${result.message}` : 'Not saved. Check your connection and try again.', { warn: true });
  }, [requireActor, toast, undoEntry, whose]);

  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 2000);
    return () => clearTimeout(t);
  }, [justSaved]);
  useEffect(() => {
    if (dirty) setJustSaved(false);
  }, [dirty]);

  // ⌘S saves; ⌘Z (outside a text field) undoes your last save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.altKey || e.shiftKey) return;
      const k = e.key.toLowerCase();
      if (k === 's') {
        e.preventDefault();
        void save();
      } else if (k === 'z') {
        const el = e.target as HTMLElement | null;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
        const entry = undoStack.current[undoStack.current.length - 1];
        if (!entry) return;
        e.preventDefault();
        void undoEntry(entry);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, undoEntry]);

  const setDay = (day: DayOfWeek, ranges: TimeRange[]) => dispatch({ type: 'edit', day, ranges });

  const effect = useMemo(
    () => (state.draft && props.outings ? weekEffect(state.draft, props.outings, new Date()) : null),
    [state.draft, props.outings],
  );

  const targetName = nameOf(targetId);
  const step = (d: number) => setDayIdx((i) => Math.min(6, Math.max(0, i + d)));

  const saveControls = (
    <SaveControls
      dirty={dirty}
      valid={valid}
      saving={state.saving}
      justSaved={justSaved}
      onSave={() => void save()}
      onDiscard={() => dispatch({ type: 'discard' })}
    />
  );

  return (
    <div className="b-page b-av">
      <header className="b-top">
        <div>
          <h1>
            Availability<span className="b-tag">Beta</span>
          </h1>
          <div className="sub">
            {targetId && !isSelf ? (
              <>
                Editing <b className="b-av-who">{targetName ?? '…'}</b> ·{' '}
                <button type="button" className="b-link" onClick={() => setTarget(null)}>
                  {actorId ? 'Back to you' : 'Stop'}
                </button>{' '}
                ·{' '}
              </>
            ) : (
              'When you can’t row, every week · '
            )}
            <button type="button" className="b-link" onClick={() => setSwitching(true)}>
              Edit someone else
            </button>
          </div>
        </div>
        {editable && <div className="b-nav b-av-desk">{saveControls}</div>}
      </header>

      {props.error && <div className="b-list b-empty">{props.error}</div>}

      {!props.error && booted && !targetId && (
        <div className="b-list b-av-intro">
          <h2>Who are you?</h2>
          <p>Choose your name to set the times you can’t row. Coaches and captains see it when they pick crews.</p>
          <div className="b-av-row-actions">
            <button type="button" className="b-btn b-av-primary" onClick={() => openPicker()}>
              Choose your name
            </button>
            <button type="button" className="b-btn" onClick={() => setSwitching(true)}>
              Edit someone else
            </button>
          </div>
        </div>
      )}

      {!props.error && targetId && (state.load === 'loading' || state.memberId !== targetId) && (
        <div className="b-list b-empty" aria-busy="true">
          Loading {isSelf ? 'your' : `${targetName ?? 'their'}'s`} availability…
        </div>
      )}

      {!props.error && targetId && state.memberId === targetId && state.load === 'error' && (
        <div className="b-list b-empty" role="alert">
          Couldn’t load {isSelf ? 'your' : `${targetName ?? 'their'}'s`} availability, so there’s nothing safe to edit.{' '}
          <button type="button" className="b-link" onClick={() => dispatch({ type: 'select', memberId: targetId })}>
            Try again
          </button>
        </div>
      )}

      {editable && state.draft && (
        <>
          {state.staleBy !== undefined && (
            <div className="b-av-notice" role="status">
              <span className="b-dot no" />
              <span>
                {nameOf(state.staleBy) ?? 'Someone'} just saved this. Your unsaved edits would be refused; load theirs to carry on.
              </span>
              <button type="button" className="b-link" onClick={() => dispatch({ type: 'reload' })}>
                Show theirs
              </button>
            </div>
          )}

          {effect && <Effect effect={effect} self={isSelf} name={targetName} />}

          <div className="b-av-tabs" role="tablist" aria-label="Day">
            {DAYS_OF_WEEK.map((d, i) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={i === dayIdx}
                className={i === dayIdx ? 'on' : ''}
                onClick={() => setDayIdx(i)}
              >
                {DAY_LABELS_SHORT[d].slice(0, 2)}
                <span className={`b-av-mark${dayError(state.draft![d]) ? ' err' : state.draft![d].length ? ' set' : ''}`} />
              </button>
            ))}
          </div>

          <fieldset
            className="b-list b-av-grid"
            disabled={state.saving}
            onTouchStart={(e) => {
              touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }}
            onTouchEnd={(e) => {
              const t = touch.current;
              touch.current = null;
              if (!t) return;
              const s = swipeStep(e.changedTouches[0].clientX - t.x, e.changedTouches[0].clientY - t.y);
              if (s) step(s);
            }}
          >
            <legend className="b-av-sr">Unavailable times for each day</legend>
            {DAYS_OF_WEEK.map((day, i) => (
              <DayRow
                key={day}
                day={day}
                current={i === dayIdx}
                ranges={state.draft![day]}
                outings={props.outings ?? []}
                onChange={(r) => setDay(day, r)}
                onPrev={i > 0 ? () => step(-1) : undefined}
                onNext={i < 6 ? () => step(1) : undefined}
              />
            ))}
          </fieldset>

          <div className="b-av-meta">
            <span>
              {state.base?.updatedAt
                ? `Last saved ${dayLabel(new Date(state.base.updatedAt))}, ${hhmm(new Date(state.base.updatedAt))}${state.base.updatedBy ? ` by ${state.base.updatedBy === actorId ? 'you' : nameOf(state.base.updatedBy) ?? 'someone'}` : ''}`
                : 'Nothing saved yet.'}
            </span>
            <span className="b-av-keys">
              <kbd>⌘</kbd>
              <kbd>S</kbd> save · <kbd>⌘</kbd>
              <kbd>Z</kbd> undo last save
            </span>
          </div>

          <div className="b-av-bar">{saveControls}</div>
        </>
      )}

      {switching && (
        <MemberSwitcher
          members={props.members}
          currentId={targetId}
          onChoose={(id) => {
            setSwitching(false);
            setTarget(id);
          }}
          onClose={() => setSwitching(false)}
        />
      )}
    </div>
  );
}

function SaveControls(props: {
  dirty: boolean;
  valid: boolean;
  saving: boolean;
  justSaved: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="b-av-save">
      <span className="b-av-state" aria-live="polite">
        {props.saving ? null : props.dirty ? (
          props.valid ? (
            <>
              <span className="b-dot maybe" /> Unsaved changes
            </>
          ) : (
            <>
              <span className="b-dot no" /> Fix the times in red
            </>
          )
        ) : props.justSaved ? (
          <>
            <span className="b-dot ok" /> Saved
          </>
        ) : (
          ''
        )}
      </span>
      {props.dirty && !props.saving && (
        <button type="button" className="b-btn" onClick={props.onDiscard}>
          Discard
        </button>
      )}
      <button
        type="button"
        className="b-btn b-av-primary"
        disabled={!props.dirty || !props.valid || props.saving}
        onClick={props.onSave}
      >
        {props.saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}

function Effect(props: { effect: ReturnType<typeof weekEffect<WeekOuting>>; self: boolean; name: string | null }) {
  const { upcoming, unavailable, maybe } = props.effect;
  const will = props.self ? 'You’ll' : `${props.name ?? 'They'} will`;
  if (upcoming === 0) return <div className="b-av-effect b-muted">No more published outings this week.</div>;
  const n = (k: number) => `${k} outing${k === 1 ? '' : 's'}`;
  const listed = [...unavailable.map((o) => ({ o, tone: 'no' })), ...maybe.map((o) => ({ o, tone: 'maybe' }))].sort(
    (a, b) => a.o.start_at!.localeCompare(b.o.start_at!),
  );
  return (
    <details className="b-av-effect">
      <summary>
        {unavailable.length === 0 && maybe.length === 0 ? (
          <>
            <span className="b-dot ok" /> {will} show as free for {upcoming === 1 ? 'the one outing' : `all ${upcoming} outings`} left this week.
          </>
        ) : (
          <>
            <span className={`b-dot ${unavailable.length ? 'no' : 'maybe'}`} /> {will} show as unavailable for{' '}
            <b>{n(unavailable.length)}</b>
            {maybe.length > 0 && (
              <>
                {' '}
                and maybe free for <b>{n(maybe.length)}</b>
              </>
            )}{' '}
            of the {upcoming} left this week.
          </>
        )}
      </summary>
      {listed.length > 0 && (
        <ul>
          {listed.map(({ o, tone }) => (
            <li key={o.id}>
              <span className={`b-dot ${tone}`} />
              <span className="b-mono">
                {shortDay(new Date(o.start_at!))} {hhmm(new Date(o.start_at!))}
              </span>
              <span>{o.name || 'Outing'}</span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

function DayRow(props: {
  day: DayOfWeek;
  current: boolean;
  ranges: TimeRange[];
  outings: WeekOuting[];
  onChange: (ranges: TimeRange[]) => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const { day, ranges, onChange } = props;
  const error = dayError(ranges);
  const whole = isWholeDay(ranges);
  const label = DAY_LABELS[day];
  const lastRef = useRef<HTMLInputElement | null>(null);
  const focusNew = useRef(false);

  useEffect(() => {
    if (focusNew.current) {
      focusNew.current = false;
      lastRef.current?.focus();
    }
  }, [ranges.length]);

  const add = (range: TimeRange) => {
    focusNew.current = true;
    onChange(sortRanges([...ranges, range]));
  };
  const set = (i: number, field: 'start' | 'end', value: string) =>
    onChange(ranges.map((r, j) => (j === i ? { ...r, [field]: value } : r)));
  const remove = (i: number) => onChange(ranges.filter((_, j) => j !== i));

  const next = nextRange(ranges);
  const dayOutings = props.outings.filter((o) => o.start_at && londonParts(new Date(o.start_at)).weekday === day);

  return (
    <section className={`b-av-day${props.current ? ' cur' : ''}${error ? ' bad' : ''}`} aria-label={label}>
      <div className="b-av-label">
        <button type="button" className="b-icon b-av-step" aria-label="Previous day" disabled={!props.onPrev} onClick={props.onPrev}>
          <Chevron dir="left" />
        </button>
        <span>
          <span className="full">{label}</span>
          <span className="short">{DAY_LABELS_SHORT[day]}</span>
        </span>
        <button type="button" className="b-icon b-av-step" aria-label="Next day" disabled={!props.onNext} onClick={props.onNext}>
          <Chevron dir="right" />
        </button>
      </div>

      <div className="b-av-ranges">
        {ranges.length === 0 && <span className="b-av-free">Free all day</span>}
        {whole ? (
          <span className="b-av-range whole">
            <span>Unavailable all day</span>
            <button type="button" className="b-av-x" aria-label={`Clear ${label}`} onClick={() => onChange([])}>
              <Cross />
            </button>
          </span>
        ) : (
          ranges.map((r, i) => {
            const issue = rangeIssue(ranges, i);
            return (
              <span key={i} className={`b-av-range${issue ? ' bad' : ''}`}>
                <input
                  ref={i === ranges.length - 1 ? lastRef : undefined}
                  type="time"
                  step={900}
                  value={r.start}
                  aria-label={`${label} range ${i + 1} from`}
                  aria-invalid={!!issue}
                  onChange={(e) => set(i, 'start', e.target.value)}
                />
                <span className="dash">–</span>
                <input
                  type="time"
                  step={900}
                  value={r.end}
                  aria-label={`${label} range ${i + 1} until`}
                  aria-invalid={!!issue}
                  onChange={(e) => set(i, 'end', e.target.value)}
                />
                <button type="button" className="b-av-x" aria-label={`Remove ${label} ${r.start}–${r.end}`} onClick={() => remove(i)}>
                  <Cross />
                </button>
              </span>
            );
          })
        )}
        {error && <span className="b-av-err">{error}</span>}
      </div>

      <Timeline ranges={ranges} outings={dayOutings} />

      <div className="b-av-row-actions">
        {!whole && ranges.length < MAX_RANGES && (
          <button
            type="button"
            className="b-btn b-av-add"
            disabled={!canAdd(ranges, next)}
            onClick={() => add(next)}
            title={`Add ${next.start}–${next.end}`}
          >
            + Add
          </button>
        )}
        {!whole &&
          PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="b-btn b-av-preset"
              disabled={!canAdd(ranges, p.range)}
              onClick={() => add(p.range)}
              title={`Add ${p.range.start}–${p.range.end}`}
            >
              {p.label}
            </button>
          ))}
        <button
          type="button"
          className={`b-btn b-av-preset${whole ? ' on' : ''}`}
          aria-pressed={whole}
          onClick={() => onChange(whole ? [] : [WHOLE_DAY])}
          title="Unavailable 00:00–23:59"
        >
          All day
        </button>
      </div>
    </section>
  );
}

/** The day at a glance, 06:00–22:00: your ranges as red blocks, this week's outings as ticks. */
function Timeline(props: { ranges: TimeRange[]; outings: WeekOuting[] }) {
  const FROM = 6 * 60;
  const TO = 22 * 60;
  const pct = (min: number) => `${(Math.min(TO, Math.max(FROM, min)) - FROM) / (TO - FROM) * 100}%`;
  const toMin = (t: string) => {
    const m = /^(\d{2}):(\d{2})$/.exec(t);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  return (
    <div className="b-av-line" aria-hidden="true">
      {[9, 12, 15, 18].map((h) => (
        <span key={h} className="hour" style={{ left: pct(h * 60) }} />
      ))}
      {props.ranges.map((r, i) => {
        const a = toMin(r.start);
        const b = toMin(r.end);
        if (a === null || b === null || b <= a || b <= FROM || a >= TO) return null;
        return <span key={i} className="block" style={{ left: pct(a), width: `calc(${pct(b)} - ${pct(a)})` }} />;
      })}
      {props.outings.map((o) => {
        const p = londonParts(new Date(o.start_at!));
        const m = p.hh * 60 + p.mm;
        if (m < FROM || m > TO) return null;
        return <span key={o.id} className="tick" style={{ left: pct(m) }} title={`${o.name} ${hhmm(new Date(o.start_at!))}`} />;
      })}
    </div>
  );
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d={dir === 'left' ? 'M8.5 3L4.5 7l4 4' : 'M5.5 3l4 4-4 4'}
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Cross() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
