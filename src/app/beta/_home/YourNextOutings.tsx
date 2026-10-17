'use client';
// Home: my seats over the next seven days, each with the same one-tap reply as My week.
import Link from 'next/link';
import { useState } from 'react';
import { useIdentity } from '../_components/Identity';
import { MyOutingRow } from '../week/MyOutingRow';
import { useMyOutings } from '../week/useMyOutings';
import { useNow } from '../week/useNow';

const SHOW = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

export function YourNextOutings() {
  const { openPicker } = useIdentity();
  // A rolling week from now, fixed for the life of the page
  const [range] = useState(() => {
    const now = Date.now();
    return { from: new Date(now - 3 * 60 * 60 * 1000).toISOString(), to: new Date(now + 7 * DAY_MS).toISOString() };
  });
  const { actorId, rows, loadState, saved, reply, undo } = useMyOutings(range.from, range.to);
  const now = useNow();
  // Outings that are over drop off Home (My week still lists them)
  const upcoming = rows.filter((r) => new Date(r.outing.end_at ?? r.outing.start_at!).getTime() >= now);
  const shown = upcoming.slice(0, SHOW);

  return (
    <section className="h-sec" aria-labelledby="h-mine">
      <header className="h-head">
        <h2 id="h-mine">Your next outings</h2>
        <Link className="h-more" href="/beta/week">
          My week
        </Link>
      </header>
      <div className="b-list">
        {!actorId ? (
          <div className="h-empty">
            Choose your name to see your seats and reply in one tap.{' '}
            <button type="button" className="b-link" onClick={openPicker}>
              Who are you?
            </button>
          </div>
        ) : loadState === 'error' ? (
          <div className="h-empty">Couldn&apos;t load your outings. Refresh to try again.</div>
        ) : loadState !== 'ready' ? (
          <div className="h-empty">Loading your outings…</div>
        ) : shown.length === 0 ? (
          <div className="h-empty">
            You&apos;re not in any outings in the next 7 days.{' '}
            <Link className="b-link" href="/beta/schedule">
              Find one in the schedule
            </Link>
          </div>
        ) : (
          <>
            {shown.map((item) => (
              <MyOutingRow
                key={item.key}
                item={item}
                now={now}
                saved={saved[item.key]}
                onReply={(status) => void reply(item.outing.id, item.seat, status)}
                onUndo={(id) => void undo(id)}
              />
            ))}
            {upcoming.length > SHOW && (
              <Link className="h-row h-tail" href="/beta/week">
                {upcoming.length - SHOW} more in My week
              </Link>
            )}
          </>
        )}
      </div>
    </section>
  );
}
