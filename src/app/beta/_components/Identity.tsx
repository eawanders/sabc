'use client';
// "Who are you?": the member this device writes as (src/lib/live/identity.ts). No login.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { clearStoredActorId, getStoredActorId, storeActorId } from '@/lib/live/identity';
import { toCanonicalId } from '@/lib/live/schemas';
import { loadMembers, type DirectoryMember } from '../_lib/directory';
import { pickerKey } from '../_lib/keyboard';

type IdentityValue = {
  actorId: string | null;
  actorName: string | null;
  /** The actor id, asking "Who are you?" first if this device hasn't chosen. Null if dismissed. */
  requireActor: () => Promise<string | null>;
  openPicker: () => void;
  pickerOpen: boolean;
};

const IdentityContext = createContext<IdentityValue>({
  actorId: null,
  actorName: null,
  requireActor: async () => null,
  openPicker: () => {},
  pickerOpen: false,
});

export function useIdentity(): IdentityValue {
  return useContext(IdentityContext);
}

export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const [actorId, setActorId] = useState<string | null>(null);
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const waiters = useRef<((id: string | null) => void)[]>([]);

  useEffect(() => {
    const stored = getStoredActorId();
    setActorId(stored ? toCanonicalId(stored) : null);
    loadMembers()
      .then(setMembers)
      .catch(() => setMembers([]));
  }, []);

  // A stored id that is no longer a member is forgotten
  useEffect(() => {
    if (actorId && members.length > 0 && !members.some((m) => m.id === actorId)) {
      clearStoredActorId();
      setActorId(null);
    }
  }, [actorId, members]);

  const settle = useCallback((id: string | null) => {
    setPickerOpen(false);
    const pending = waiters.current;
    waiters.current = [];
    pending.forEach((resolve) => resolve(id));
  }, []);

  const choose = useCallback(
    (id: string) => {
      storeActorId(id);
      setActorId(id);
      settle(id);
    },
    [settle],
  );

  const requireActor = useCallback(() => {
    if (actorId) return Promise.resolve(actorId);
    setPickerOpen(true);
    return new Promise<string | null>((resolve) => waiters.current.push(resolve));
  }, [actorId]);

  const value = useMemo<IdentityValue>(
    () => ({
      actorId,
      actorName: members.find((m) => m.id === actorId)?.name ?? null,
      requireActor,
      openPicker: () => setPickerOpen(true),
      pickerOpen,
    }),
    [actorId, members, requireActor, pickerOpen],
  );

  return (
    <IdentityContext.Provider value={value}>
      {children}
      {pickerOpen && <WhoPicker members={members} onChoose={choose} onClose={() => settle(null)} />}
    </IdentityContext.Provider>
  );
}

function WhoPicker({
  members,
  onChoose,
  onClose,
}: {
  members: DirectoryMember[];
  onChoose: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    return members.filter((m) => m.name.toLowerCase().includes(s));
  }, [members, q]);

  useEffect(() => {
    listRef.current?.querySelector('.kb')?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  return (
    <div className="b-pal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="b-pal" role="dialog" aria-modal="true" aria-label="Who are you?">
        <div className="doc">
          <h2 style={{ fontSize: 16 }}>Who are you?</h2>
          <p>Choose your name once. This device remembers it; there&apos;s no password.</p>
        </div>
        <div className="b-pal-in" style={{ borderTop: '1px solid var(--line)' }}>
          <input
            autoFocus
            value={q}
            placeholder="Type your name…"
            aria-label="Your name"
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
              else if (intent.type === 'choose') onChoose(matches[intent.index].id);
              else onClose();
            }}
          />
        </div>
        <div className="list" ref={listRef} role="listbox" aria-label="Members">
          {members.length === 0 && <div className="b-grp">Loading members…</div>}
          {matches.map((m, i) => (
            <button
              key={m.id}
              type="button"
              role="option"
              aria-selected={i === idx}
              className={`b-opt${i === idx ? ' kb' : ''}`}
              onMouseMove={() => setIdx(i)}
              onClick={() => onChoose(m.id)}
            >
              <span />
              <span className="n">{m.name}</span>
              <span className="s">{m.member_type.includes('Cox') ? 'Cox' : m.member_type.includes('Coach') ? 'Coach' : ''}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SignedInAs() {
  const { actorId, actorName, openPicker } = useIdentity();
  return (
    <span className="b-me">
      {actorId ? (
        <>
          Signed in as <b>{actorName ?? '…'}</b> ·{' '}
        </>
      ) : (
        'Not signed in · '
      )}
      <button type="button" className="b-link" onClick={openPicker}>
        {actorId ? 'Switch' : 'Choose your name'}
      </button>
    </span>
  );
}
