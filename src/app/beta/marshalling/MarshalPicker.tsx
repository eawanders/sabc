'use client';
// Command-palette picker for "sign someone else up": search members, or add a guest by name
// (as today's drawer can), or clear the slot.
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadMembers, type DirectoryMember } from '../_lib/directory';
import { pickerKey } from '../_lib/keyboard';

type Item = { kind: 'member'; member: DirectoryMember } | { kind: 'guest'; name: string } | { kind: 'clear' };

export function MarshalPicker(props: {
  context: string;
  currentId: string | null;
  onChooseMember: (member: DirectoryMember) => void;
  onAddGuest: (name: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<DirectoryMember[] | null>(null);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMembers()
      .then(setMembers)
      .catch(() => setMembers([]));
  }, []);

  const items = useMemo<Item[]>(() => {
    const s = q.trim().toLowerCase();
    const out: Item[] = [];
    if (props.currentId && !s) out.push({ kind: 'clear' });
    const matches = (members ?? []).filter((m) => m.name.toLowerCase().includes(s));
    for (const m of matches) out.push({ kind: 'member', member: m });
    const name = q.trim().replace(/\s+/g, ' ');
    if (name.length >= 2 && !(members ?? []).some((m) => m.name.toLowerCase() === name.toLowerCase())) {
      out.push({ kind: 'guest', name });
    }
    return out;
  }, [members, q, props.currentId]);

  useEffect(() => {
    listRef.current?.querySelector('.kb')?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  const choose = (item: Item | undefined) => {
    if (!item) return;
    if (item.kind === 'clear') props.onClear();
    else if (item.kind === 'guest') props.onAddGuest(item.name);
    else props.onChooseMember(item.member);
  };

  return (
    <div className="b-pal-bg" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className="b-pal" role="dialog" aria-modal="true" aria-label="Sign someone up">
        <div className="b-pal-in">
          <span className="ctx">{props.context}</span>
          <input
            autoFocus
            value={q}
            placeholder="Sign up a member, or type a guest's name…"
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
          {members === null && <div className="b-grp">Loading members…</div>}
          {members !== null && items.length === 0 && <div className="b-grp">Type a name to search</div>}
          {items.map((item, i) => {
            const common = {
              type: 'button' as const,
              role: 'option',
              'aria-selected': i === idx,
              className: `b-opt${i === idx ? ' kb' : ''}`,
              onMouseMove: () => setIdx(i),
              onClick: () => choose(item),
            };
            if (item.kind === 'clear') {
              return (
                <button key="clear" {...common}>
                  <span className="b-dot unk" />
                  <span className="n">Clear slot</span>
                  <span className="s" />
                </button>
              );
            }
            if (item.kind === 'guest') {
              return (
                <button key="guest" {...common}>
                  <span className="c-plus" aria-hidden="true">+</span>
                  <span className="n">Add “{item.name}” as a guest and sign up</span>
                  <span className="s">Guest</span>
                </button>
              );
            }
            const m = item.member;
            return (
              <button key={m.id} {...common}>
                <span className={`b-dot ${m.id === props.currentId ? 'ok' : 'unk'}`} />
                <span className="n">{m.name}</span>
                <span className="s">{m.id === props.currentId ? 'signed up' : m.member_type.includes('Coach') ? 'Coach' : ''}</span>
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
            <kbd>↵</kbd> sign up
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
