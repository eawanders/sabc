'use client';
// The dense week list (or month calendar), filters, and the crew drawer. Opening an outing or
// changing a filter only changes the query string (history API), so it is instant and shareable.
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFlagStatus } from '@/hooks/useFlagStatus';
import { CrewDrawer, Status, type DrawerTab } from '../_components/CrewDrawer';
import { useIdentity } from '../_components/Identity';
import { loadMembers, type DirectoryMember } from '../_lib/directory';
import { isCrewSeat, outingStatusTone } from '../_lib/seats';
import { dayLabel, hhmm, mondayOf, weekLabel } from '../_lib/time';
import { londonDate, monthLabel } from './_lib/calendar';
import { TYPE_FILTERS, applyFilters, divisions, hasFilters, readFilters, withFilters, type Filters } from './_lib/filters';
import { crewSize, type ScheduleOuting } from './_lib/load';
import { flagStopsOutings } from './_lib/rules';
import './schedule.css';

type Live = Record<string, { filled: number; status: string | null }>;

const TYPE_LABEL: Record<keyof typeof TYPE_FILTERS, string> = { water: 'Water', erg: 'Erg', tank: 'Tank', gym: 'Gym' };

export function ScheduleClient(props: {
  view: 'week' | 'month';
  week: string;
  prevWeek: string;
  nextWeek: string;
  thisWeek: string;
  month: string;
  prevMonth: string;
  nextMonth: string;
  thisMonth: string;
  gridDays: string[];
  outings: ScheduleOuting[];
  error: string | null;
}) {
  const params = useSearchParams();
  const openId = params.get('outing') ?? null;
  const tab: DrawerTab = params.get('tab') === 'report' ? 'report' : 'crew';
  const filters = readFilters(params);
  const { actorId, actorName, requireActor } = useIdentity();
  const { flagStatus } = useFlagStatus();
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  // Live crew counts reported by the drawer, over the server-rendered ones
  const [live, setLive] = useState<Live>({});

  useEffect(() => {
    loadMembers().then(setMembers).catch(() => {});
  }, []);

  const navigate = useCallback(
    (query: string, push: boolean) => {
      const url = `/beta/schedule?${query}`;
      if (push) window.history.pushState(null, '', url);
      else window.history.replaceState(null, '', url);
    },
    [],
  );

  const baseQuery = useCallback(() => {
    const q = new URLSearchParams(params.toString());
    if (props.view === 'month') {
      q.set('view', 'month');
      if (!q.get('month')) q.set('month', props.month);
    } else if (!q.get('week')) q.set('week', props.week);
    return q;
  }, [params, props.view, props.month, props.week]);

  const setOpen = useCallback(
    (id: string | null, nextTab: DrawerTab = 'crew') => {
      const q = baseQuery();
      if (id) q.set('outing', id);
      else q.delete('outing');
      if (id && nextTab === 'report') q.set('tab', 'report');
      else q.delete('tab');
      // Moving between outings or tabs replaces; opening and closing are history steps
      navigate(q.toString(), !(id && openId));
    },
    [baseQuery, navigate, openId],
  );

  const setFilters = useCallback(
    (next: Partial<Filters>) => navigate(withFilters(baseQuery().toString(), next), false),
    [baseQuery, navigate],
  );

  const onCrewChange = useCallback((id: string, filled: number, status: string | null) => {
    setLive((l) => (l[id]?.filled === filled && l[id]?.status === status ? l : { ...l, [id]: { filled, status } }));
  }, []);

  const shown = useMemo(() => applyFilters(props.outings, filters), [props.outings, filters]);
  const divs = useMemo(() => divisions(props.outings), [props.outings]);
  const open = props.outings.find((o) => o.id === openId);

  // Who already sits in another outing that day (crew or bank rider), for the picker's hint
  const busyElsewhere = useMemo(() => {
    if (!open?.start_at) return undefined;
    const day = londonDate(new Date(open.start_at));
    const out: Record<string, string> = {};
    for (const o of props.outings) {
      if (o.id === open.id || !o.start_at || o.status === 'Cancelled' || londonDate(new Date(o.start_at)) !== day) continue;
      for (const s of o.seats) {
        if (isCrewSeat(s.seat) || s.seat === 'Coach/Bank Rider') out[s.member_id] = `in ${o.name || o.div || 'another outing'} ${hhmm(new Date(o.start_at))}`;
      }
    }
    return out;
  }, [open, props.outings]);

  // Keep the filters when moving between weeks / months / views
  const keep = (extra: Record<string, string>) => {
    const q = new URLSearchParams();
    for (const k of ['type', 'div', 'member'] as const) {
      const v = params.get(k);
      if (v) q.set(k, v);
    }
    for (const [k, v] of Object.entries(extra)) q.set(k, v);
    return `/beta/schedule?${q.toString()}`;
  };
  const monthView = props.view === 'month';
  const weekOfMonth = props.month === props.thisMonth ? props.thisWeek : mondayOf(new Date(`${props.month}-01T12:00:00Z`));
  const monthOfWeek = props.week.slice(0, 7);
  const memberName = filters.member ? members.find((m) => m.id === filters.member)?.name ?? (filters.member === actorId ? actorName : null) : null;
  const mine = Boolean(actorId && filters.member === actorId);

  return (
    <div className="b-page">
      <header className="b-top">
        <div>
          <h1>
            Schedule<span className="b-tag">Beta</span>
          </h1>
          <div className="sub">{monthView ? monthLabel(props.month) : weekLabel(props.week)}</div>
        </div>
        <div className="b-nav">
          <div className="b-seg" role="group" aria-label="View">
            <Link className={monthView ? '' : 'on'} aria-current={!monthView} href={keep({ week: monthView ? weekOfMonth : props.week })}>
              Week
            </Link>
            <Link className={monthView ? 'on' : ''} aria-current={monthView} href={keep({ view: 'month', month: monthView ? props.month : monthOfWeek })}>
              Month
            </Link>
          </div>
          <Link
            className="b-icon"
            href={monthView ? keep({ view: 'month', month: props.prevMonth }) : keep({ week: props.prevWeek })}
            aria-label={monthView ? 'Previous month' : 'Previous week'}
            title={monthView ? 'Previous month' : 'Previous week'}
          >
            <Chevron dir="left" />
          </Link>
          {(monthView ? props.month !== props.thisMonth : props.week !== props.thisWeek) && (
            <Link className="b-btn" href={monthView ? keep({ view: 'month', month: props.thisMonth }) : keep({ week: props.thisWeek })}>
              {monthView ? 'This month' : 'This week'}
            </Link>
          )}
          <Link
            className="b-icon"
            href={monthView ? keep({ view: 'month', month: props.nextMonth }) : keep({ week: props.nextWeek })}
            aria-label={monthView ? 'Next month' : 'Next week'}
            title={monthView ? 'Next month' : 'Next week'}
          >
            <Chevron dir="right" />
          </Link>
        </div>
      </header>

      {flagStopsOutings(flagStatus) && (
        <div className="b-banner warn" role="status">
          <span>
            <b>{flagStatus} flag.</b> No crews are allowed out.
          </span>
        </div>
      )}

      <div className="b-filters" role="group" aria-label="Filters">
        <button
          type="button"
          className={`b-chip${mine ? ' on' : ''}`}
          aria-pressed={mine}
          onClick={async () => {
            if (mine) return setFilters({ member: null });
            const id = actorId ?? (await requireActor());
            if (id) setFilters({ member: id });
          }}
        >
          My outings
        </button>
        <label className="b-select">
          <span className="b-sr">Type</span>
          <select value={filters.type ?? ''} onChange={(e) => setFilters({ type: (e.target.value || null) as Filters['type'] })}>
            <option value="">All types</option>
            {Object.entries(TYPE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="b-select">
          <span className="b-sr">Division</span>
          <select value={filters.div ?? ''} onChange={(e) => setFilters({ div: e.target.value || null })}>
            <option value="">All divisions</option>
            {filters.div && !divs.includes(filters.div) && <option value={filters.div}>{filters.div}</option>}
            {divs.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="b-select">
          <span className="b-sr">Member</span>
          <select value={filters.member ?? ''} onChange={(e) => setFilters({ member: e.target.value || null })}>
            <option value="">Anyone</option>
            {filters.member && !members.some((m) => m.id === filters.member) && (
              <option value={filters.member}>{memberName ?? 'Selected member'}</option>
            )}
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        {hasFilters(filters) && (
          <button type="button" className="b-btn ghost" onClick={() => setFilters({ type: null, div: null, member: null })}>
            Clear
          </button>
        )}
      </div>

      {monthView ? (
        <MonthGrid
          days={props.gridDays}
          month={props.month}
          outings={shown}
          error={props.error}
          filtered={hasFilters(filters)}
          openId={openId}
          live={live}
          onOpen={(id) => setOpen(id)}
          onClear={() => setFilters({ type: null, div: null, member: null })}
          weekHref={(d) => keep({ week: mondayOf(new Date(`${d}T12:00:00Z`)) })}
        />
      ) : (
        <WeekList
          outings={shown}
          error={props.error}
          filtered={hasFilters(filters)}
          total={props.outings.length}
          openId={openId}
          live={live}
          onOpen={(id) => setOpen(id)}
          onClear={() => setFilters({ type: null, div: null, member: null })}
        />
      )}

      {openId && (
        <CrewDrawer
          key={openId}
          outingId={openId}
          initial={open}
          onClose={() => setOpen(null)}
          onCrewChange={onCrewChange}
          tab={tab}
          onTabChange={(t) => setOpen(openId, t)}
          busyElsewhere={busyElsewhere}
        />
      )}
    </div>
  );
}

function groupByDay(outings: ScheduleOuting[]) {
  const groups: { key: string; label: string; outings: ScheduleOuting[] }[] = [];
  for (const o of outings) {
    if (!o.start_at) continue;
    const d = new Date(o.start_at);
    const key = londonDate(d);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: dayLabel(d), outings: [] };
      groups.push(g);
    }
    g.outings.push(o);
  }
  return groups;
}

function Empty(props: { error: string | null; filtered: boolean; what: string; onClear: () => void }) {
  if (props.error) return <div className="b-empty" role="alert">{props.error}</div>;
  if (props.filtered) {
    return (
      <div className="b-empty">
        No outings match these filters {props.what}.{' '}
        <button type="button" className="b-link" onClick={props.onClear}>
          Clear filters
        </button>
      </div>
    );
  }
  return <div className="b-empty">No published outings {props.what}.</div>;
}

function WeekList(props: {
  outings: ScheduleOuting[];
  error: string | null;
  filtered: boolean;
  total: number;
  openId: string | null;
  live: Live;
  onOpen: (id: string) => void;
  onClear: () => void;
}) {
  const days = useMemo(() => groupByDay(props.outings), [props.outings]);
  return (
    <div className="b-list">
      {(props.error || days.length === 0) && <Empty error={props.error} filtered={props.filtered && props.total > 0} what="this week" onClear={props.onClear} />}
      {!props.error &&
        days.map((g) => (
          <section key={g.key} aria-label={g.label}>
            <div className="b-day">
              <span>{g.label}</span>
              <span>{g.outings.length}</span>
            </div>
            {g.outings.map((o) => (
              <OutingRow key={o.id} o={o} live={props.live[o.id]} current={o.id === props.openId} onOpen={props.onOpen} />
            ))}
          </section>
        ))}
    </div>
  );
}

function OutingRow(props: { o: ScheduleOuting; live?: { filled: number; status: string | null }; current: boolean; onOpen: (id: string) => void }) {
  const { o } = props;
  const start = new Date(o.start_at!);
  const filled = props.live?.filled ?? o.crewFilled;
  const status = props.live ? props.live.status : o.status;
  return (
    <button
      type="button"
      className={`b-orow${status === 'Cancelled' ? ' cancelled' : ''}`}
      aria-current={props.current}
      onClick={() => props.onOpen(o.id)}
    >
      <span className="b-mono">
        {hhmm(start)}
        {o.end_at && <span className="b-end">–{hhmm(new Date(o.end_at))}</span>}
      </span>
      <span className="nm">{o.name || 'Outing'}</span>
      <span className="ty">{o.type ?? ''}</span>
      <span className="dv">{o.div ?? ''}</span>
      <span className="cn" title="Crew seated">
        {filled}/{crewSize(o.type)}
      </span>
      <span title={status ?? 'Unknown'} aria-label={status ?? 'Unknown status'}>
        <Status tone={outingStatusTone(status)} text="" />
      </span>
    </button>
  );
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function MonthGrid(props: {
  days: string[];
  month: string;
  outings: ScheduleOuting[];
  error: string | null;
  filtered: boolean;
  openId: string | null;
  live: Live;
  onOpen: (id: string) => void;
  onClear: () => void;
  weekHref: (day: string) => string;
}) {
  const byDay = useMemo(() => {
    const m = new Map<string, ScheduleOuting[]>();
    for (const o of props.outings) {
      if (!o.start_at) continue;
      const k = londonDate(new Date(o.start_at));
      m.set(k, [...(m.get(k) ?? []), o]);
    }
    return m;
  }, [props.outings]);
  const today = londonDate(new Date());
  const inMonth = props.outings.some((o) => o.start_at && londonDate(new Date(o.start_at)).startsWith(props.month));

  return (
    <>
      {(props.error || !inMonth) && (
        <div className="b-list">
          <Empty error={props.error} filtered={props.filtered} what="this month" onClear={props.onClear} />
        </div>
      )}
      {!props.error && (
        <div className="b-month" aria-label="Month">
          {WEEKDAYS.map((d) => (
            <div key={d} className="b-wd" aria-hidden="true">
              {d}
            </div>
          ))}
          {props.days.map((d) => {
            const list = byDay.get(d) ?? [];
            const out = !d.startsWith(props.month);
            const day = Number(d.slice(8));
            return (
              <section
                key={d}
                className={`b-cell${out ? ' out' : ''}${d === today ? ' today' : ''}${list.length === 0 ? ' none' : ''}`}
                aria-label={dayLabel(new Date(`${d}T12:00:00Z`))}
              >
                <Link className="dn" href={props.weekHref(d)} title="Open this week" aria-label={`Week of ${dayLabel(new Date(`${d}T12:00:00Z`))}`}>
                  <span className="full">{dayLabel(new Date(`${d}T12:00:00Z`))}</span>
                  <span className="num">{day}</span>
                </Link>
                {list.map((o) => {
                  const status = props.live[o.id] ? props.live[o.id].status : o.status;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      className={`b-mchip${status === 'Cancelled' ? ' cancelled' : ''}`}
                      aria-current={o.id === props.openId}
                      onClick={() => props.onOpen(o.id)}
                      title={`${hhmm(new Date(o.start_at!))} ${o.name} · ${status ?? 'Unknown'}`}
                    >
                      <span className={`b-dot ${outingStatusTone(status)}`} />
                      <span className="b-mono">{hhmm(new Date(o.start_at!))}</span>
                      <span className="nm">{o.name || 'Outing'}</span>
                    </button>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </>
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
