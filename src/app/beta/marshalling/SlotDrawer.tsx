'use client';
// One marshal slot: Notion-style properties, the clash warning, notes, and who is signed up.
import { Status } from '../_components/CrewDrawer';
import { personTone, slotTitle, type MarshalSlot } from '../_lib/club-marshal';
import { dayLabel, hhmm } from '../_lib/time';

export function SlotDrawer(props: {
  slot: MarshalSlot | null;
  personName: string | null;
  pending: boolean;
  isMe: boolean;
  onSignMeUp: () => void;
  onPick: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const s = props.slot;
  const start = s?.start_at ? new Date(s.start_at) : null;
  const end = s?.end_at ? new Date(s.end_at) : null;

  return (
    <aside className="b-drawer" role="dialog" aria-label={s ? slotTitle(s) : 'Slot'}>
      <div className="b-crumbs">
        <button type="button" onClick={props.onClose} className="b-muted">
          Marshalling
        </button>
        <span>/</span>
        <span>{start ? dayLabel(start) : s?.day ?? '—'}</span>
        <span>/</span>
        <b>{s ? s.shift ?? s.name : 'Slot'}</b>
        <span className="sp" />
        <button type="button" className="b-icon" onClick={props.onClose} aria-label="Close (Esc)" title="Close (Esc)">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {!s && <p className="b-note">This slot isn&apos;t published or no longer exists.</p>}

      {s && (
        <>
          <div className="b-doc">
            <h2>{slotTitle(s)}</h2>
            <dl className="b-props">
              <dt>Time</dt>
              <dd>
                {start
                  ? `${dayLabel(start)}, ${s.all_day ? 'all day' : `${hhmm(start)}${end ? `–${hhmm(end)}` : ''}`}`
                  : s.day ?? '—'}
              </dd>
              <dt>Event</dt>
              <dd>{s.event ?? '—'}</dd>
              <dt>Role</dt>
              <dd>{[s.role, s.shift].filter(Boolean).join(' · ') || '—'}</dd>
              <dt>Location</dt>
              <dd>{s.location ?? '—'}</dd>
              {s.slot_no != null && (
                <>
                  <dt>Slot</dt>
                  <dd className="b-mono">#{s.slot_no}</dd>
                </>
              )}
              <dt>Signed up</dt>
              <dd className={props.pending ? 'c-pending' : undefined}>
                {s.person_id ? (
                  <Status tone={personTone(s)} text={`${props.personName ?? '…'}${props.isMe ? ' (you)' : ''} · ${s.person_status}`} />
                ) : (
                  <Status tone="unk" text="Open" />
                )}
              </dd>
            </dl>
          </div>

          {s.clash_crews.length > 0 && (
            <div className="c-callout">
              <span className="b-dot no" />
              <span>
                <b>Crew clash.</b> Rowers in {s.clash_crews.join(', ')} can&apos;t take this slot (race time ± 1 hour
                overlaps the shift).
              </span>
            </div>
          )}
          {s.notes && <p className="c-notes">{s.notes}</p>}

          <div className="c-actions">
            {!s.person_id && (
              <button type="button" className="b-btn c-primary" disabled={props.pending} onClick={props.onSignMeUp}>
                Sign me up <kbd>S</kbd>
              </button>
            )}
            <button type="button" className="b-btn" disabled={props.pending} onClick={props.onPick}>
              {s.person_id ? 'Change person…' : 'Sign up someone else…'} <kbd>A</kbd>
            </button>
            {s.person_id && (
              <button type="button" className="b-btn" disabled={props.pending} onClick={props.onClear}>
                Clear <kbd>⌫</kbd>
              </button>
            )}
          </div>
          <p className="b-note">Signing up confirms the slot. First come, first served: if someone beats you to it, you&apos;ll see who.</p>
          <div className="b-keys" aria-hidden="true" style={{ marginTop: 'auto' }}>
            <span>
              <kbd>S</kbd> sign me up
            </span>
            <span>
              <kbd>A</kbd> someone else
            </span>
            <span>
              <kbd>⌫</kbd> clear
            </span>
            <span>
              <kbd>⌘Z</kbd> undo
            </span>
            <span>
              <kbd>esc</kbd> close
            </span>
          </div>
        </>
      )}
    </aside>
  );
}
