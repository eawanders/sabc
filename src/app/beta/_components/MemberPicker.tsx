'use client';
// Command-palette member picker: search, grouped Free / Maybe free / Unavailable for this outing.
// Also: mark a seat Reserved, add a guest by typing their name, cox eligibility under the flag,
// and who is already in another outing that day.
import { useEffect, useMemo, useRef, useState } from 'react';
import { pickerItems, type PickerItem, type WeeklyUnavailability } from '../_lib/availability';
import { pickerKey } from '../_lib/keyboard';
import { seatLabel, seatShort, type StatusTone } from '../_lib/seats';
import type { DirectoryMember } from '../_lib/directory';

const FIT_TONE: Record<'free' | 'maybe' | 'unavailable', StatusTone> = { free: 'ok', maybe: 'maybe', unavailable: 'no' };

type Selectable =
  | Exclude<PickerItem<DirectoryMember>, { kind: 'group' }>
  | { kind: 'reserve' }
  | { kind: 'guest'; name: string };

/** True when `q` names nobody in `members` exactly (case and spacing ignored). */
export function isNewName(q: string, members: { name: string }[]): boolean {
  const n = q.trim().replace(/\s+/g, ' ').toLowerCase();
  return n.length >= 2 && n.length <= 80 && !members.some((m) => m.name.trim().replace(/\s+/g, ' ').toLowerCase() === n);
}

export function MemberPicker(props: {
  seat: string;
  members: DirectoryMember[];
  unavailability: Record<string, WeeklyUnavailability>;
  start: Date | null;
  end: Date | null;
  seatedIn: Record<string, string>;
  canClear: boolean;
  onChoose: (memberId: string | null) => void;
  onClose: () => void;
  /** Offer "Mark reserved" (seat held, no one named). */
  onReserve?: () => void;
  /** Offer "Add <typed name> as a guest". */
  onAddGuest?: (name: string) => void;
  /** Cox seat: is this member allowed to cox under the flag? null = can't tell. */
  coxCheck?: (memberId: string) => { eligible: boolean | null; experience: string | null };
  flagLabel?: string | null;
  /** member id → the other outing they sit in that day ("O1 07:00"). */
  busyElsewhere?: Record<string, string>;
}) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo(
    () =>
      pickerItems({
        members: props.members,
        unavailability: props.unavailability,
        start: props.start,
        end: props.end,
        query: q,
        seatedIn: props.seatedIn,
        canClear: props.canClear,
      }),
    [props.members, props.unavailability, props.start, props.end, q, props.seatedIn, props.canClear],
  );
  const guestName = props.onAddGuest && props.members.length > 0 && isNewName(q, props.members) ? q.trim().replace(/\s+/g, ' ') : null;
  const reserveItem: Selectable[] = props.onReserve && !q.trim() ? [{ kind: 'reserve' }] : [];
  const guestItem: Selectable[] = guestName ? [{ kind: 'guest', name: guestName }] : [];
  const memberRows = items.filter((i) => i.kind !== 'clear');
  const clearRows = items.filter((i) => i.kind === 'clear') as Selectable[];
  const selectable: Selectable[] = [
    ...clearRows,
    ...reserveItem,
    ...(memberRows.filter((i) => i.kind !== 'group') as Selectable[]),
    ...guestItem,
  ];

  useEffect(() => {
    listRef.current?.querySelector('.kb')?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  const choose = (item: Selectable | undefined) => {
    if (!item) return;
    if (item.kind === 'reserve') props.onReserve?.();
    else if (item.kind === 'guest') props.onAddGuest?.(item.name);
    else props.onChoose(item.kind === 'clear' ? null : item.member.id);
  };

  let n = -1;
  return (
    <div className="b-pal-bg" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className="b-pal" role="dialog" aria-modal="true" aria-label={`Assign ${seatLabel(props.seat)}`}>
        <div className="b-pal-in">
          <span className="ctx">{seatShort(props.seat)}</span>
          <input
            autoFocus
            value={q}
            placeholder={props.onAddGuest ? 'Assign member or type a guest’s name…' : 'Assign member…'}
            aria-label="Search members"
            autoComplete="off"
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            onKeyDown={(e) => {
              const intent = pickerKey(e.key, { index: idx, count: selectable.length });
              if (!intent) return;
              e.preventDefault();
              e.stopPropagation();
              if (intent.type === 'move') setIdx(intent.index);
              else if (intent.type === 'choose') choose(selectable[intent.index]);
              else props.onClose();
            }}
          />
        </div>
        <div className="list" ref={listRef} role="listbox" aria-label="Members">
          {props.members.length === 0 && <div className="b-grp">Loading members…</div>}
          {props.members.length > 0 && selectable.length === 0 && <div className="b-grp">No one matches “{q}”</div>}
          {[...clearRows, ...reserveItem, ...memberRows, ...guestItem].map((item) => {
            if (item.kind === 'group') {
              return (
                <div key={`g-${item.fit}`} className="b-grp">
                  {item.title}
                </div>
              );
            }
            const i = ++n;
            const active = i === idx;
            const common = {
              type: 'button' as const,
              role: 'option',
              'aria-selected': active,
              className: `b-opt${active ? ' kb' : ''}`,
              onMouseMove: () => setIdx(i),
              onClick: () => choose(item),
            };
            if (item.kind === 'clear') {
              return (
                <button key="clear" {...common}>
                  <span className="b-dot unk" />
                  <span className="n">Clear seat</span>
                  <span className="s">
                    <kbd>⌫</kbd>
                  </span>
                </button>
              );
            }
            if (item.kind === 'reserve') {
              return (
                <button key="reserve" {...common}>
                  <span className="b-dot unk" />
                  <span className="n">Mark reserved</span>
                  <span className="s">held, no name</span>
                </button>
              );
            }
            if (item.kind === 'guest') {
              return (
                <button key="guest" {...common}>
                  <span className="b-plus" aria-hidden="true">+</span>
                  <span className="n">
                    Add “{item.name}” as a guest
                  </span>
                  <span className="s">new</span>
                </button>
              );
            }
            const cox = props.coxCheck?.(item.member.id);
            const notEligible = cox?.eligible === false;
            const hint = item.seatedIn
              ? `in ${seatLabel(item.seatedIn)}`
              : cox
                ? [cox.experience ?? 'Experience unknown', notEligible ? `not on ${props.flagLabel ?? 'this'} flag` : null].filter(Boolean).join(' · ')
                : props.busyElsewhere?.[item.member.id]
                  ? `also ${props.busyElsewhere[item.member.id]}`
                  : roleHint(item.member);
            return (
              <button key={item.member.id} {...common}>
                <span className={`b-dot ${notEligible ? 'no' : FIT_TONE[item.fit]}`} />
                <span className={`n${notEligible ? ' b-muted' : ''}`}>{item.member.name}</span>
                <span className={`s${notEligible || (!item.seatedIn && props.busyElsewhere?.[item.member.id]) ? ' warn' : ''}`}>{hint}</span>
              </button>
            );
          })}
        </div>
        <div className="b-pal-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> move
          </span>
          <span>
            <kbd>↵</kbd> assign
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

function roleHint(m: DirectoryMember): string {
  if (m.member_type.includes('Cox')) return 'Cox';
  if (m.member_type.includes('Coach')) return 'Coach';
  return '';
}
