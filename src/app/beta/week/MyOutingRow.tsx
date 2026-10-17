'use client';
// One of my seats: when, what, which seat, crew n/9, and a three-way reply that saves on tap.
import Link from 'next/link';
import { forwardRef } from 'react';
import { REPLIES, type MyRow } from '../_lib/myweek-state';
import { seatLabel, statusDisplay } from '../_lib/seats';
import { hhmm, londonParts, mondayOf, shortDay } from '../_lib/time';
import type { SavedNote } from './useMyOutings';

export function scheduleHref(outingId: string, startIso: string | null): string {
  const week = startIso ? mondayOf(new Date(startIso)) : mondayOf(new Date());
  return `/beta/schedule?week=${week}&outing=${outingId}`;
}

type Props = {
  item: MyRow;
  now: number;
  saved: SavedNote | undefined;
  focused?: boolean;
  onReply: (status: string) => void;
  onUndo: (changeId: number) => void;
  onFocus?: () => void;
};

export const MyOutingRow = forwardRef<HTMLDivElement, Props>(function MyOutingRow(
  { item, now, saved, focused, onReply, onUndo, onFocus },
  ref,
) {
  const { outing, seat, row, pending, crewFilled } = item;
  const start = new Date(outing.start_at!);
  const end = outing.end_at ? new Date(outing.end_at) : null;
  const past = (end ?? start).getTime() < now;
  const p = londonParts(start);
  const reply = REPLIES.find((r) => r.status === row.status);
  const other = reply ? null : statusDisplay(row.status).text;
  const cancelled = outing.status === 'Cancelled';
  const label = `${outing.name || 'Outing'}, ${shortDay(start)} ${p.d}, ${hhmm(start)}`;

  return (
    <div
      ref={ref}
      className={`w-row${past ? ' past' : ''}${focused ? ' focus' : ''}`}
      tabIndex={onFocus ? -1 : undefined}
      onFocus={onFocus}
      data-key={item.key}
    >
      <span className="w-date b-mono">
        {shortDay(start)} {p.d}
      </span>
      <Link className="w-title" href={scheduleHref(outing.id, outing.start_at)}>
        <b>{outing.name || 'Outing'}</b>
        <span>
          {hhmm(start)}
          {end && `–${hhmm(end)}`} · {seatLabel(seat)} · <span className="w-crew">{crewFilled}/9 crew</span>
          {cancelled && <span className="w-cancel"> · Cancelled</span>}
          {other && ` · ${other}`}
        </span>
      </Link>
      <div className="w-seg" role="group" aria-label={`Your reply for ${label}`}>
        {REPLIES.map((r) => (
          <button
            key={r.status}
            type="button"
            aria-pressed={row.status === r.status}
            disabled={past}
            onClick={() => onReply(r.status)}
          >
            <span className={`b-dot ${r.tone}`} />
            {r.label}
          </button>
        ))}
      </div>
      <div className="w-saved" aria-live="polite">
        {pending ? (
          'Saving…'
        ) : saved ? (
          <>
            Saved · your crew sees this now ·{' '}
            <button type="button" className="b-link" onClick={() => onUndo(saved.changeId)}>
              Undo
            </button>
          </>
        ) : past ? (
          'Finished'
        ) : null}
      </div>
    </div>
  );
});
