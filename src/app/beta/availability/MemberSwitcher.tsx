'use client';
// "Edit someone else": a quiet command palette over the member list (anyone can edit anyone, as today).
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DirectoryMember } from '../_lib/directory';
import { pickerKey } from '../_lib/keyboard';

export function MemberSwitcher(props: {
  members: DirectoryMember[];
  currentId: string | null;
  onChoose: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    return props.members.filter((m) => m.name.toLowerCase().includes(s));
  }, [props.members, q]);

  useEffect(() => {
    listRef.current?.querySelector('.kb')?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  return (
    <div className="b-pal-bg" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className="b-pal" role="dialog" aria-modal="true" aria-label="Edit someone else's availability">
        <div className="b-pal-in">
          <span className="ctx">Edit</span>
          <input
            autoFocus
            value={q}
            placeholder="Whose availability?"
            aria-label="Search members"
            autoComplete="off"
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            onKeyDown={(e) => {
              const intent = pickerKey(e.key, { index: idx, count: matches.length });
              if (!intent) return;
              e.preventDefault();
              e.stopPropagation();
              if (intent.type === 'move') setIdx(intent.index);
              else if (intent.type === 'choose') props.onChoose(matches[intent.index].id);
              else props.onClose();
            }}
          />
        </div>
        <div className="list" ref={listRef} role="listbox" aria-label="Members">
          {props.members.length === 0 && <div className="b-grp">No members loaded</div>}
          {props.members.length > 0 && matches.length === 0 && <div className="b-grp">No one matches “{q}”</div>}
          {matches.map((m, i) => (
            <button
              key={m.id}
              type="button"
              role="option"
              aria-selected={i === idx}
              className={`b-opt${i === idx ? ' kb' : ''}`}
              onMouseMove={() => setIdx(i)}
              onClick={() => props.onChoose(m.id)}
            >
              <span />
              <span className="n">{m.name}</span>
              <span className="s">{m.id === props.currentId ? 'Showing' : ''}</span>
            </button>
          ))}
        </div>
        <div className="b-pal-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> move
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
