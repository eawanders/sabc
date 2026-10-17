'use client';
// Crew drawer, variant A: breadcrumb, Notion-style properties, one dense row per seat,
// command-palette assignment, and a keyboard model (see ../_lib/keyboard.ts).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFlagStatus } from '@/hooks/useFlagStatus';
import { useLiveUnavailability } from '../_lib/availability-live';
import { loadMembers, type DirectoryMember } from '../_lib/directory';
import { drawerKey } from '../_lib/keyboard';
import { viewSeat } from '../_lib/seatState';
import {
  BANK_RIDER,
  CREW_SEATS,
  SEAT_ORDER,
  SUB_SEATS,
  flagTone,
  outingStatusTone,
  seatShort,
  statusDisplay,
  type StatusTone,
} from '../_lib/seats';
import { dayLabel, hhmm } from '../_lib/time';
import { useIdentity } from './Identity';
import { MemberPicker } from './MemberPicker';
import { useCrew, type CrewOuting } from './useCrew';

// Clicking the status cycles it, as in the prototype
const NEXT_STATUS: Record<string, string> = {
  Available: 'Maybe Available',
  'Maybe Available': 'Not Available',
  'Not Available': 'Available',
};

export function CrewDrawer(props: {
  outingId: string;
  initial?: CrewOuting;
  onClose: () => void;
  onCrewChange?: (outingId: string, filled: number, status: string | null) => void;
}) {
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const unavailability = useLiveUnavailability();
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const crew = useCrew(props.outingId, (id) => (id ? byId.get(id)?.name ?? null : null));
  const [focus, setFocus] = useState(1);
  const [pickerSeat, setPickerSeat] = useState<string | null>(null);
  const { pickerOpen: whoOpen } = useIdentity();
  const { flagStatus } = useFlagStatus();
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    loadMembers().then(setMembers).catch(() => {});
  }, []);

  const outing = crew.outing ?? props.initial ?? null;
  const start = outing?.start_at ? new Date(outing.start_at) : null;
  const end = outing?.end_at ? new Date(outing.end_at) : null;
  const filled = CREW_SEATS.filter((s) => crew.view(s)?.member_id).length;

  const { onCrewChange } = props;
  useEffect(() => {
    if (crew.loadState === 'ready') onCrewChange?.(props.outingId, filled, crew.outing?.status ?? null);
  }, [crew.loadState, filled, crew.outing?.status, props.outingId, onCrewChange]);

  const seatedIn = useMemo(() => {
    const out: Record<string, string> = {};
    for (const s of SEAT_ORDER) {
      const m = viewSeat(crew.seats, s)?.member_id;
      if (m) out[m] = s;
    }
    return out;
  }, [crew.seats]);

  // Keyboard: active while no dialog is open and focus isn't in a text field
  const latest = useRef({ focus, crew, pickerSeat, whoOpen, onClose: props.onClose });
  latest.current = { focus, crew, pickerSeat, whoOpen, onClose: props.onClose };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { focus, crew, pickerSeat, whoOpen, onClose } = latest.current;
      if (pickerSeat || whoOpen || crew.loadState !== 'ready') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const intent = drawerKey(
        { key: e.key, meta: e.metaKey, ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey },
        { focus, count: SEAT_ORDER.length, filled: (i) => Boolean(crew.view(SEAT_ORDER[i])?.member_id) },
      );
      if (!intent) return;
      e.preventDefault();
      switch (intent.type) {
        case 'focus':
          setFocus(intent.index);
          rowRefs.current[intent.index]?.scrollIntoView({ block: 'nearest' });
          break;
        case 'open-picker':
          setPickerSeat(SEAT_ORDER[intent.index]);
          break;
        case 'set-status':
          void crew.setStatus(SEAT_ORDER[intent.index], intent.status);
          break;
        case 'clear':
          void crew.assign(SEAT_ORDER[intent.index], null);
          break;
        case 'undo':
          crew.undoLast();
          break;
        case 'close':
          onClose();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const row = (seat: string) => {
    const i = SEAT_ORDER.indexOf(seat);
    const v = crew.view(seat);
    const memberId = v?.member_id ?? null;
    const name = memberId ? byId.get(memberId)?.name ?? '…' : null;
    const st = statusDisplay(v?.status);
    const pending = Boolean(crew.seats.pending[seat]);
    return (
      <div
        key={seat}
        ref={(el) => {
          rowRefs.current[i] = el;
        }}
        className={`b-srow${i === focus ? ' focus' : ''}${crew.flash[seat] ? ' b-flash' : ''}${pending ? ' pending' : ''}`}
        onMouseDown={() => setFocus(i)}
      >
        <span className="b-mono">{seatShort(seat)}</span>
        <button
          type="button"
          className={`nm${name ? '' : ' empty'}`}
          onClick={() => {
            setFocus(i);
            setPickerSeat(seat);
          }}
          aria-label={`${seatShort(seat)}: ${name ?? (v?.status === 'Reserved' ? 'Reserved' : 'empty')}. Assign`}
        >
          {name ?? (v?.status === 'Reserved' ? 'Reserved' : 'Assign…')}
        </button>
        {memberId ? (
          <button
            type="button"
            className="stbtn"
            title="Change status (1/2/3)"
            onClick={() => void crew.setStatus(seat, NEXT_STATUS[v?.status ?? ''] ?? 'Available')}
          >
            <Status tone={st.tone} text={st.text} />
          </button>
        ) : (
          <span />
        )}
      </div>
    );
  };

  const statusTone = outingStatusTone(outing?.status);

  return (
    <aside className="b-drawer" role="dialog" aria-label={outing?.name ?? 'Outing'}>
      <div className="b-crumbs">
        <button type="button" onClick={props.onClose} className="b-muted">
          Schedule
        </button>
        <span>/</span>
        <span>{start ? dayLabel(start) : '—'}</span>
        <span>/</span>
        <b>{outing?.name || 'Outing'}</b>
        <span className="sp" />
        <button type="button" className="b-icon" onClick={props.onClose} aria-label="Close (Esc)" title="Close (Esc)">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {crew.loadState === 'missing' && <p className="b-note">This outing isn&apos;t published or no longer exists.</p>}
      {crew.loadState === 'error' && <p className="b-note">Couldn&apos;t load this outing. Check your connection and reopen it.</p>}

      {outing && crew.loadState !== 'missing' && (
        <>
          <div className="b-doc">
            <h2>{outing.name || 'Outing'}</h2>
            <dl className="b-props">
              <dt>Time</dt>
              <dd>{start ? `${dayLabel(start)}, ${hhmm(start)}${end ? `–${hhmm(end)}` : ''}` : '—'}</dd>
              <dt>Division</dt>
              <dd>{[outing.div, outing.shell ?? outing.type].filter(Boolean).join(' · ') || '—'}</dd>
              <dt>Status</dt>
              <dd>
                <Status tone={statusTone} text={outing.status ?? 'Unknown'} />
              </dd>
              <dt>Flag</dt>
              <dd>
                <Status tone={flagTone(flagStatus)} text={flagStatus ?? 'Unknown'} />
              </dd>
              <dt>Crew</dt>
              <dd>{crew.loadState === 'ready' ? `${filled} of 9 seated` : '…'}</dd>
            </dl>
          </div>
          <div className="b-scroll" aria-label="Seats">
            {crew.loadState === 'ready' ? (
              <>
                <div className="b-group">
                  <span>Bank rider</span>
                </div>
                {row(BANK_RIDER)}
                <div className="b-group">
                  <span>Crew</span>
                  <span>{filled}/9</span>
                </div>
                {CREW_SEATS.map(row)}
                <div className="b-group">
                  <span>Subs</span>
                </div>
                {SUB_SEATS.map(row)}
              </>
            ) : (
              <p className="b-note">Loading crew…</p>
            )}
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
              <kbd>1</kbd>
              <kbd>2</kbd>
              <kbd>3</kbd> status
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

      {pickerSeat && (
        <MemberPicker
          seat={pickerSeat}
          members={members}
          unavailability={unavailability}
          start={start}
          end={end}
          seatedIn={seatedIn}
          canClear={Boolean(crew.view(pickerSeat)?.member_id)}
          onClose={() => setPickerSeat(null)}
          onChoose={(memberId) => {
            const seat = pickerSeat;
            setPickerSeat(null);
            if (memberId === (crew.view(seat)?.member_id ?? null)) return;
            const from = memberId ? seatedIn[memberId] : undefined;
            if (from) void crew.move(from, seat);
            else void crew.assign(seat, memberId);
          }}
        />
      )}
    </aside>
  );
}

export function Status({ tone, text }: { tone: StatusTone; text: string }) {
  return (
    <span className="b-st">
      <span className={`b-dot ${tone}`} />
      {text}
    </span>
  );
}
