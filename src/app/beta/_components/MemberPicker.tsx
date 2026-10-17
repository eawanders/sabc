'use client';
// Command-palette member picker: search, grouped Free / Maybe free / Unavailable for this outing.
import { useEffect, useMemo, useRef, useState } from 'react';
import { pickerItems, type PickerItem, type WeeklyUnavailability } from '../_lib/availability';
import { pickerKey } from '../_lib/keyboard';
import { seatLabel, seatShort, type StatusTone } from '../_lib/seats';
import type { DirectoryMember } from '../_lib/directory';

const FIT_TONE: Record<'free' | 'maybe' | 'unavailable', StatusTone> = { free: 'ok', maybe: 'maybe', unavailable: 'no' };

type Selectable = Exclude<PickerItem<DirectoryMember>, { kind: 'group' }>;

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
  const selectable = items.filter((i): i is Selectable => i.kind !== 'group');

  useEffect(() => {
    listRef.current?.querySelector('.kb')?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  const choose = (item: Selectable | undefined) => {
    if (!item) return;
    props.onChoose(item.kind === 'clear' ? null : item.member.id);
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
            placeholder="Assign member…"
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
          {items.map((item) => {
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
            return (
              <button key={item.member.id} {...common}>
                <span className={`b-dot ${FIT_TONE[item.fit]}`} />
                <span className="n">{item.member.name}</span>
                <span className="s">{item.seatedIn ? `in ${seatLabel(item.seatedIn)}` : roleHint(item.member)}</span>
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
