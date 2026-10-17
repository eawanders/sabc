'use client';
// The dense week list plus the crew drawer. Opening an outing only changes ?outing= (history
// pushState), so it is instant and the URL can be shared.
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { CrewDrawer, Status } from '../_components/CrewDrawer';
import { outingStatusTone } from '../_lib/seats';
import { dayLabel, hhmm, londonParts, weekLabel } from '../_lib/time';
import type { WeekOuting } from '../_lib/week';

export function ScheduleClient(props: {
  week: string;
  prevWeek: string;
  nextWeek: string;
  thisWeek: string;
  outings: WeekOuting[];
  error: string | null;
}) {
  const params = useSearchParams();
  const openId = params.get('outing') ?? null;
  // Live crew counts reported by the drawer, over the server-rendered ones
  const [live, setLive] = useState<Record<string, { filled: number; status: string | null }>>({});

  const setOpen = useCallback(
    (id: string | null) => {
      const q = new URLSearchParams(params.toString());
      if (!q.get('week')) q.set('week', props.week);
      if (id) q.set('outing', id);
      else q.delete('outing');
      const url = `/beta/schedule?${q.toString()}`;
      if (id && openId) window.history.replaceState(null, '', url);
      else window.history.pushState(null, '', url);
    },
    [params, props.week, openId],
  );

  const onCrewChange = useCallback((id: string, filled: number, status: string | null) => {
    setLive((l) => (l[id]?.filled === filled && l[id]?.status === status ? l : { ...l, [id]: { filled, status } }));
  }, []);

  const days = useMemo(() => {
    const groups: { key: string; label: string; outings: WeekOuting[] }[] = [];
    for (const o of props.outings) {
      if (!o.start_at) continue;
      const d = new Date(o.start_at);
      const p = londonParts(d);
      const key = `${p.y}-${p.m}-${p.d}`;
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: dayLabel(d), outings: [] };
        groups.push(g);
      }
      g.outings.push(o);
    }
    return groups;
  }, [props.outings]);

  const open = props.outings.find((o) => o.id === openId);

  return (
    <div className="b-page">
      <header className="b-top">
        <div>
          <h1>
            Schedule<span className="b-tag">Beta</span>
          </h1>
          <div className="sub">{weekLabel(props.week)}</div>
        </div>
        <div className="b-nav">
          <Link className="b-icon" href={`/beta/schedule?week=${props.prevWeek}`} aria-label="Previous week" title="Previous week">
            <Chevron dir="left" />
          </Link>
          {props.week !== props.thisWeek && (
            <Link className="b-btn" href={`/beta/schedule?week=${props.thisWeek}`}>
              This week
            </Link>
          )}
          <Link className="b-icon" href={`/beta/schedule?week=${props.nextWeek}`} aria-label="Next week" title="Next week">
            <Chevron dir="right" />
          </Link>
        </div>
      </header>

      <div className="b-list">
        {props.error && <div className="b-empty">{props.error}</div>}
        {!props.error && days.length === 0 && <div className="b-empty">No published outings this week.</div>}
        {days.map((g) => (
          <section key={g.key} aria-label={g.label}>
            <div className="b-day">
              <span>{g.label}</span>
              <span>{g.outings.length}</span>
            </div>
            {g.outings.map((o) => {
              const start = new Date(o.start_at!);
              const filled = live[o.id]?.filled ?? o.crewFilled;
              const status = live[o.id] ? live[o.id].status : o.status;
              return (
                <button
                  key={o.id}
                  type="button"
                  className="b-orow"
                  aria-current={o.id === openId}
                  onClick={() => setOpen(o.id)}
                >
                  <span className="b-mono">
                    {hhmm(start)}
                    {o.end_at && <span className="b-end">–{hhmm(new Date(o.end_at))}</span>}
                  </span>
                  <span className="nm">{o.name || 'Outing'}</span>
                  <span className="ty">{o.type ?? ''}</span>
                  <span className="dv">{o.div ?? ''}</span>
                  <span className="cn" title="Crew seated">
                    {filled}/9
                  </span>
                  <span title={status ?? 'Unknown'} aria-label={status ?? 'Unknown status'}>
                    <Status tone={outingStatusTone(status)} text="" />
                  </span>
                </button>
              );
            })}
          </section>
        ))}
      </div>

      {openId && (
        <CrewDrawer
          key={openId}
          outingId={openId}
          initial={open}
          onClose={() => setOpen(null)}
          onCrewChange={onCrewChange}
        />
      )}
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
