'use client';
// Crew drawer, variant A: breadcrumb, Notion-style properties, one dense row per seat,
// command-palette assignment, and a keyboard model (see ../_lib/keyboard.ts).
// Plus (PER-277 parity): river requirements and what auto-confirm still needs, cox experience
// against the flag, Reserved seats, guests, "Swap in subs", the outing report tab, share and
// add-to-calendar.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFlagStatus } from '@/hooks/useFlagStatus';
import { addGuestMember } from '@/lib/live/members';
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
  seatLabel,
  seatShort,
  statusDisplay,
  type StatusTone,
} from '../_lib/seats';
import { dayLabel, hhmm, mondayOf } from '../_lib/time';
import { confirmRequirements, coxEligible, flagRequirements, subSwaps } from '../schedule/_lib/rules';
import { googleCalendarUrl, icsFile, outingLink, outingTitle } from '../schedule/_lib/share';
import { loadCoxExperience } from './coxExperience';
import { useIdentity } from './Identity';
import { MemberPicker } from './MemberPicker';
import { ReportPanel } from './ReportPanel';
import { useToast } from './Toasts';
import { useCrew, type CrewOuting } from './useCrew';
import '../schedule/schedule.css';

// Clicking the status cycles it, as in the prototype
const NEXT_STATUS: Record<string, string> = {
  Available: 'Maybe Available',
  'Maybe Available': 'Not Available',
  'Not Available': 'Available',
};

export type DrawerTab = 'crew' | 'report';

export function CrewDrawer(props: {
  outingId: string;
  initial?: CrewOuting;
  onClose: () => void;
  onCrewChange?: (outingId: string, filled: number, status: string | null) => void;
  /** Crew (default) or the outing report; controlled by the page so it can live in the URL. */
  tab?: DrawerTab;
  onTabChange?: (tab: DrawerTab) => void;
  /** member id → the other outing they sit in the same day, for the picker's hint. */
  busyElsewhere?: Record<string, string>;
}) {
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const unavailability = useLiveUnavailability();
  const [coxExp, setCoxExp] = useState<Record<string, string>>({});
  const guestNames = useRef<Record<string, string>>({});
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const crew = useCrew(props.outingId, (id) => (id ? byId.get(id)?.name ?? guestNames.current[id] ?? null : null));
  const [focus, setFocus] = useState(1);
  const [pickerSeat, setPickerSeat] = useState<string | null>(null);
  const [localTab, setLocalTab] = useState<DrawerTab>('crew');
  const tab = props.tab ?? localTab;
  const setTab = props.onTabChange ?? setLocalTab;
  const { pickerOpen: whoOpen, requireActor } = useIdentity();
  const toast = useToast();
  const { flagStatus } = useFlagStatus();
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    loadMembers().then(setMembers).catch(() => {});
    loadCoxExperience().then(setCoxExp).catch(() => {});
  }, []);

  const outing = crew.outing ?? props.initial ?? null;
  const water = outing?.type === 'Water Outing';
  // Other sessions have no cox; the bank rider seat is the coach
  const crewSeats = useMemo(() => (water || !outing ? [...CREW_SEATS] : CREW_SEATS.filter((s) => s !== 'Cox')), [water, outing]);
  const order = useMemo(() => [BANK_RIDER, ...crewSeats, ...SUB_SEATS], [crewSeats]);
  const startAt = outing?.start_at ?? null;
  const endAt = outing?.end_at ?? null;
  const start = useMemo(() => (startAt ? new Date(startAt) : null), [startAt]);
  const end = useMemo(() => (endAt ? new Date(endAt) : null), [endAt]);
  const filled = crewSeats.filter((s) => crew.view(s)?.member_id).length;
  const coxId = crew.view('Cox')?.member_id ?? null;
  const coxExperience = coxId ? coxExp[coxId] ?? null : null;
  const swaps = crew.loadState === 'ready' ? subSwaps(crew.view) : [];

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

  const choose = useCallback(
    (seat: string, memberId: string | null) => {
      if (memberId === (crew.view(seat)?.member_id ?? null) && crew.view(seat)?.status !== 'Reserved') return;
      const from = memberId ? seatedIn[memberId] : undefined;
      if (from && from !== seat) void crew.move(from, seat);
      else if (!from) void crew.assign(seat, memberId);
    },
    [crew, seatedIn],
  );

  const addGuest = useCallback(
    async (seat: string, name: string) => {
      const actor = await requireActor();
      if (!actor) return;
      const result = await addGuestMember({ name, actor });
      if (!result.ok) {
        toast(result.reason, { warn: true });
        return;
      }
      const { member } = result;
      guestNames.current[member.id] = member.name;
      setMembers((list) =>
        list.some((m) => m.id === member.id)
          ? list
          : [...list, { id: member.id, name: member.name, member_type: ['Non-Member'] }].sort((a, b) => a.name.localeCompare(b.name)),
      );
      choose(seat, member.id);
    },
    [requireActor, toast, choose],
  );

  const copyLink = useCallback(async () => {
    if (!start) return;
    const url = outingLink(window.location.origin, props.outingId, mondayOf(start));
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch {
      toast(`Copy this link: ${url}`, { warn: true });
    }
  }, [props.outingId, start, toast]);

  const calTitle = outing ? outing.name || outingTitle(outing) : 'Outing';
  const downloadIcs = useCallback(() => {
    if (!start) return;
    const blob = new Blob([icsFile({ id: props.outingId, title: calTitle, details: outing?.details, start, end })], {
      type: 'text/calendar;charset=utf-8',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${calTitle.replace(/[^a-z0-9]+/gi, '-')}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, [props.outingId, calTitle, outing?.details, start, end]);

  // Keyboard: active while no dialog is open and focus isn't in a text field
  const latest = useRef({ focus, crew, pickerSeat, whoOpen, onClose: props.onClose, order, tab, setTab, swaps });
  latest.current = { focus, crew, pickerSeat, whoOpen, onClose: props.onClose, order, tab, setTab, swaps };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { focus, crew, pickerSeat, whoOpen, onClose, order, tab, setTab, swaps } = latest.current;
      if (pickerSeat || whoOpen || crew.loadState !== 'ready') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const plain = !e.metaKey && !e.ctrlKey && !e.altKey;
      // R: crew / report tab · S: swap in subs (crew tab)
      if (plain && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setTab(tab === 'report' ? 'crew' : 'report');
        return;
      }
      if (tab === 'report') {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
        return;
      }
      if (plain && e.key.toLowerCase() === 's' && swaps.length > 0) {
        e.preventDefault();
        void crew.swapSubs(swaps);
        return;
      }
      const intent = drawerKey(
        { key: e.key, meta: e.metaKey, ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey },
        { focus, count: order.length, filled: (i) => Boolean(crew.view(order[i])?.member_id) },
      );
      if (!intent) return;
      e.preventDefault();
      switch (intent.type) {
        case 'focus':
          setFocus(intent.index);
          rowRefs.current[intent.index]?.scrollIntoView({ block: 'nearest' });
          break;
        case 'open-picker':
          setPickerSeat(order[intent.index]);
          break;
        case 'set-status':
          void crew.setStatus(order[intent.index], intent.status);
          break;
        case 'clear':
          void crew.assign(order[intent.index], null);
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

  // Keep the focused row inside the list when the layout changes (water ↔ other)
  useEffect(() => {
    setFocus((f) => Math.min(f, order.length - 1));
  }, [order.length]);

  const row = (seat: string) => {
    const i = order.indexOf(seat);
    const v = crew.view(seat);
    const memberId = v?.member_id ?? null;
    const name = memberId ? byId.get(memberId)?.name ?? guestNames.current[memberId] ?? '…' : null;
    const st = statusDisplay(v?.status);
    const pending = Boolean(crew.seats.pending[seat]);
    const exp = seat === 'Cox' && memberId ? coxExp[memberId] ?? null : null;
    const coxOk = seat === 'Cox' && memberId && water ? coxEligible(flagStatus, exp) : null;
    return (
      <div
        key={seat}
        ref={(el) => {
          rowRefs.current[i] = el;
        }}
        className={`b-srow${i === focus ? ' focus' : ''}${crew.flash[seat] ? ' b-flash' : ''}${pending ? ' pending' : ''}`}
        onMouseDown={() => setFocus(i)}
      >
        <span className="b-mono">{seat === BANK_RIDER && !water ? 'CO' : seatShort(seat)}</span>
        <button
          type="button"
          className={`nm${name ? '' : ' empty'}`}
          onClick={() => {
            setFocus(i);
            setPickerSeat(seat);
          }}
          aria-label={`${seatLabel(seat)}: ${name ?? (v?.status === 'Reserved' ? 'Reserved' : 'empty')}. Assign`}
        >
          <span className="t">{name ?? (v?.status === 'Reserved' ? 'Reserved' : 'Assign…')}</span>
          {seat === 'Cox' && memberId && (
            <span className={`b-exp${coxOk === false ? ' warn' : ''}`} title={coxOk === false ? `Not allowed to cox on a ${flagStatus} flag` : 'Cox experience'}>
              {exp ?? 'experience unknown'}
              {coxOk === false ? ` · not on ${flagStatus}` : ''}
            </span>
          )}
        </button>
        {memberId ? (
          <button
            type="button"
            className="stbtn"
            title="Change status (1/2/3)"
            aria-label={`${seatLabel(seat)} status: ${st.text}. Change`}
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
  const requirements =
    outing && crew.loadState === 'ready' && outing.status !== 'Cancelled'
      ? confirmRequirements({ type: outing.type, flag: flagStatus, coxExperience, view: crew.view })
      : [];
  const river = water ? flagRequirements(flagStatus) : null;

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
        {start && (
          <button type="button" className="b-icon" onClick={() => void copyLink()} aria-label="Copy link to this outing" title="Copy link">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M6 8a2.5 2.5 0 003.5 0l2-2A2.5 2.5 0 008 2.5l-.7.7M8 6a2.5 2.5 0 00-3.5 0l-2 2A2.5 2.5 0 006 11.5l.7-.7"
                stroke="currentColor"
                strokeWidth="1.4"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
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
          <div className="b-scroll" aria-label="Outing">
            <div className="b-doc">
              <h2>{outing.name || outingTitle(outing)}</h2>
              <dl className="b-props">
                <dt>Time</dt>
                <dd>{start ? `${dayLabel(start)}, ${hhmm(start)}${end ? `–${hhmm(end)}` : ''}` : '—'}</dd>
                <dt>Session</dt>
                <dd>{[outing.div, outing.type, outing.shell].filter(Boolean).join(' · ') || '—'}</dd>
                <dt>Status</dt>
                <dd>
                  <Status tone={statusTone} text={outing.status ?? 'Unknown'} />
                </dd>
                {water && (
                  <>
                    <dt>Flag</dt>
                    <dd>
                      <Status tone={flagTone(flagStatus)} text={flagStatus ?? 'Unknown'} />
                    </dd>
                  </>
                )}
                <dt>Crew</dt>
                <dd>{crew.loadState === 'ready' ? `${filled} of ${crewSeats.length} seated` : '…'}</dd>
                {outing.details && (
                  <>
                    <dt>Notes</dt>
                    <dd className="b-pre">{outing.details}</dd>
                  </>
                )}
              </dl>
              {river && (
                <div className="b-req">
                  <div className="hd">River requirements</div>
                  <p>
                    {river.text}
                    {river.registerUrl && (
                      <>
                        {' '}
                        <a className="b-link" href={river.registerUrl} target="_blank" rel="noopener noreferrer">
                          Register here
                        </a>
                      </>
                    )}
                  </p>
                </div>
              )}
              {outing.status === 'Cancelled' && <p className="b-req-note">Cancelled: seat changes won&apos;t confirm it.</p>}
              {requirements.length > 0 && outing.status !== 'Confirmed' && (
                <div className="b-req">
                  <div className="hd">Confirms automatically when</div>
                  <ul className="b-checks">
                    {requirements.map((r) => (
                      <li key={r.key} className={r.met ? 'met' : ''}>
                        <span className={`b-dot ${r.met ? 'ok' : 'unk'}`} aria-hidden="true" />
                        <span>
                          <span className="b-sr">{r.met ? 'Done: ' : 'Not yet: '}</span>
                          {r.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="b-actions">
                {start && (
                  <>
                    <a className="b-btn" href={googleCalendarUrl({ title: calTitle, details: outing.details, start, end })} target="_blank" rel="noopener noreferrer">
                      Google Calendar
                    </a>
                    <button type="button" className="b-btn" onClick={downloadIcs} title="Download an .ics for Apple / Outlook">
                      .ics
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="b-tabs" role="tablist" aria-label="Outing sections">
              {(['crew', 'report'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  id={`tab-${t}`}
                  aria-selected={tab === t}
                  aria-controls={`panel-${t}`}
                  tabIndex={tab === t ? 0 : -1}
                  className={tab === t ? 'on' : ''}
                  onClick={() => setTab(t)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                      e.preventDefault();
                      e.stopPropagation();
                      const next = t === 'crew' ? 'report' : 'crew';
                      setTab(next);
                      document.getElementById(`tab-${next}`)?.focus();
                    }
                  }}
                >
                  {t === 'crew' ? 'Crew' : 'Report'}
                </button>
              ))}
              <span className="sp" />
              {tab === 'crew' && swaps.length > 0 && (
                <button
                  type="button"
                  className="b-btn"
                  onClick={() => void crew.swapSubs(swaps)}
                  title={swaps.map((s) => `${seatLabel(s.sub)} → ${seatLabel(s.crew)}`).join(', ') + ' (S)'}
                >
                  Swap in subs ({swaps.length})
                </button>
              )}
            </div>

            {tab === 'crew' ? (
              <div role="tabpanel" id="panel-crew" aria-labelledby="tab-crew" className="b-seats">
                {crew.loadState === 'ready' ? (
                  <>
                    <div className="b-group">
                      <span>{water ? 'Bank rider' : 'Coach'}</span>
                    </div>
                    {row(BANK_RIDER)}
                    <div className="b-group">
                      <span>{water ? 'Crew' : 'Attendees'}</span>
                      <span>
                        {filled}/{crewSeats.length}
                      </span>
                    </div>
                    {crewSeats.map(row)}
                    <div className="b-group">
                      <span>Subs</span>
                    </div>
                    {SUB_SEATS.map(row)}
                  </>
                ) : (
                  <p className="b-note">Loading crew…</p>
                )}
              </div>
            ) : (
              <div role="tabpanel" id="panel-report" aria-labelledby="tab-report">
                <ReportPanel outingId={props.outingId} />
              </div>
            )}
          </div>
          {tab === 'crew' ? (
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
              {swaps.length > 0 && (
                <span>
                  <kbd>S</kbd> swap subs
                </span>
              )}
              <span>
                <kbd>R</kbd> report
              </span>
              <span>
                <kbd>⌘Z</kbd> undo
              </span>
            </div>
          ) : (
            <div className="b-keys" aria-hidden="true">
              <span>
                <kbd>⌘↵</kbd> save
              </span>
              <span>
                <kbd>R</kbd> crew
              </span>
              <span>
                <kbd>esc</kbd> close
              </span>
            </div>
          )}
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
          canClear={Boolean(crew.view(pickerSeat)?.member_id) || crew.view(pickerSeat)?.status === 'Reserved'}
          onClose={() => setPickerSeat(null)}
          onChoose={(memberId) => {
            const seat = pickerSeat;
            setPickerSeat(null);
            choose(seat, memberId);
          }}
          onReserve={
            crew.view(pickerSeat)?.status === 'Reserved' && !crew.view(pickerSeat)?.member_id
              ? undefined
              : () => {
                  const seat = pickerSeat;
                  setPickerSeat(null);
                  void crew.reserve(seat);
                }
          }
          onAddGuest={(name) => {
            const seat = pickerSeat;
            setPickerSeat(null);
            void addGuest(seat, name);
          }}
          coxCheck={
            pickerSeat === 'Cox' && water
              ? (id) => ({ eligible: coxEligible(flagStatus, coxExp[id] ?? null), experience: coxExp[id] ?? null })
              : undefined
          }
          flagLabel={flagStatus}
          busyElsewhere={props.busyElsewhere}
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
