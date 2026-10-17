'use client';
// Command-palette picker for one slot: Book me, Clear slot, members, Add a guest.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DirectoryMember } from '../_lib/directory';
import { pickerKey } from '../_lib/keyboard';
import { slotLabel } from '../_lib/tests-messages';
import { slotPickerItems, type SlotPickerItem } from '../_lib/tests-picker';

export type SlotChoice = { kind: 'member'; memberId: string | null } | { kind: 'guest'; name: string };

export function SlotPicker(props: {
  slot: number;
  members: DirectoryMember[];
  taken: Record<string, number>;
  current: string | null;
  me: string | null;
  onChoose: (choice: SlotChoice) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const { members, taken, current, me } = props;
  const items = useMemo(() => slotPickerItems({ members, query: q, taken, current, me }), [members, q, taken, current, me]);

  useEffect(() => {
    listRef.current?.querySelector('.kb')?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  const choose = (item: SlotPickerItem<DirectoryMember> | undefined) => {
    if (!item) return;
    if (item.kind === 'guest') props.onChoose({ kind: 'guest', name: item.name });
    else props.onChoose({ kind: 'member', memberId: item.kind === 'clear' ? null : item.member.id });
  };

  const firstMember = items.findIndex((i) => i.kind === 'member');
  return (
    <div className="b-pal-bg" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className="b-pal" role="dialog" aria-modal="true" aria-label={`Assign ${slotLabel(props.slot)}`}>
        <div className="b-pal-in">
          <span className="ctx">{slotLabel(props.slot)}</span>
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
              const intent = pickerKey(e.key, { index: idx, count: items.length });
              if (!intent) return;
              e.preventDefault();
              e.stopPropagation();
              if (intent.type === 'move') setIdx(intent.index);
              else if (intent.type === 'choose') choose(items[intent.index]);
              else props.onClose();
            }}
          />
        </div>
        <div className="list" ref={listRef} role="listbox" aria-label="Members">
          {props.members.length === 0 && <div className="b-grp">Loading members…</div>}
          {items.map((item, i) => {
            const common = {
              type: 'button' as const,
              role: 'option',
              'aria-selected': i === idx,
              className: `b-opt${i === idx ? ' kb' : ''}`,
              onMouseMove: () => setIdx(i),
              onClick: () => choose(item),
            };
            const heading = i === firstMember ? <div className="b-grp">Members</div> : null;
            switch (item.kind) {
              case 'me':
                return (
                  <button key="me" {...common}>
                    <span className="b-dot ok" />
                    <span className="n">Book me</span>
                    <span className="s">{item.member.name}</span>
                  </button>
                );
              case 'clear':
                return (
                  <button key="clear" {...common}>
                    <span className="b-dot unk" />
                    <span className="n">Clear slot</span>
                    <span className="s">
                      <kbd>⌫</kbd>
                    </span>
                  </button>
                );
              case 'guest':
                return (
                  <button key="guest" {...common}>
                    <span className="bt-plus" aria-hidden="true">
                      +
                    </span>
                    <span className="n">Add “{item.name}” as a guest</span>
                    <span className="s" />
                  </button>
                );
              default:
                return (
                  <div key={item.member.id} style={{ display: 'contents' }}>
                    {heading}
                    <button {...common}>
                      <span />
                      <span className="n">{item.member.name}</span>
                      <span className="s">{item.member.id === props.current ? 'in this slot' : ''}</span>
                    </button>
                  </div>
                );
            }
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
