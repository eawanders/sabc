'use client';
// Dense marshalling list (event → day → shift) with one-tap sign-up, live during sign-up rushes,
// and a slot drawer on ?slot= (history pushState, so it is instant and shareable).
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addGuestMember } from '@/lib/live/members';
import { Status } from '../_components/CrewDrawer';
import { useIdentity } from '../_components/Identity';
import { useToast } from '../_components/Toasts';
import { groupSlots, marshalKey, personTone, type MarshalSlot } from '../_lib/club-marshal';
import { hhmm } from '../_lib/time';
import { MarshalPicker } from './MarshalPicker';
import { SlotDrawer } from './SlotDrawer';
import { useMarshalSlots } from './useMarshalSlots';

export function MarshallingClient(props: { initial: MarshalSlot[]; initialNames: Record<string, string>; error: string | null }) {
  const params = useSearchParams();
  const openId = params.get('slot');
  const live = useMarshalSlots(props.initial, props.initialNames);
  const { actorId, requireActor, pickerOpen: whoOpen } = useIdentity();
  const toast = useToast();
  const [openOnly, setOpenOnly] = useState(false);
  const [focus, setFocus] = useState(-1);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const visible = useMemo(() => (openOnly ? live.slots.filter((s) => !s.person_id || s.id === openId) : live.slots), [live.slots, openOnly, openId]);
  const groups = useMemo(() => groupSlots(visible), [visible]);
  const order = useMemo(() => groups.flatMap((e) => e.days.flatMap((d) => d.shifts.flatMap((sh) => sh.slots))), [groups]);
  const totals = useMemo(() => ({ total: live.slots.length, filled: live.slots.filter((s) => s.person_id).length }), [live.slots]);
  const open = openId ? live.slots.find((s) => s.id === openId) ?? null : null;

  const setOpen = useCallback(
    (id: string | null) => {
      const q = new URLSearchParams(params.toString());
      if (id) q.set('slot', id);
      else q.delete('slot');
      const url = `/beta/marshalling${q.toString() ? `?${q}` : ''}`;
      if (id && openId) window.history.replaceState(null, '', url);
      else window.history.pushState(null, '', url);
    },
    [params, openId],
  );

  const signMeUp = useCallback(
    async (slotId: string) => {
      const me = actorId ?? (await requireActor());
      if (me) await live.claim(slotId, me, live.names[me] ? `${live.names[me]}` : 'You');
    },
    [actorId, requireActor, live],
  );

  const addGuest = useCallback(
    async (slotId: string, name: string) => {
      const actor = await requireActor();
      if (!actor) return;
      let res: Awaited<ReturnType<typeof addGuestMember>>;
      try {
        res = await addGuestMember({ name, actor });
      } catch {
        toast("Couldn't add a guest right now. Pick an existing member instead.", { warn: true });
        return;
      }
      if (!res.ok) {
        toast(`Couldn't add ${name}: ${res.reason}`, { warn: true });
        return;
      }
      live.addName(res.member.id, res.member.name);
      await live.claim(slotId, res.member.id, res.member.name);
    },
    [requireActor, toast, live],
  );

  // Keyboard
  const latest = useRef({ order, focus, openId, pickerFor, whoOpen, live, signMeUp, setOpen });
  latest.current = { order, focus, openId, pickerFor, whoOpen, live, signMeUp, setOpen };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { order, focus, openId, pickerFor, whoOpen, live, signMeUp, setOpen } = latest.current;
      if (pickerFor || whoOpen) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const openIdx = openId ? order.findIndex((s) => s.id === openId) : -1;
      const cur = openIdx >= 0 ? openIdx : focus;
      const intent = marshalKey(
        { key: e.key, meta: e.metaKey, ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey },
        { focus: cur, count: order.length, filled: (i) => Boolean(order[i]?.person_id) },
      );
      if (!intent) return;
      if (intent.type === 'close' && !openId) return;
      e.preventDefault();
      const slot = 'index' in intent ? order[intent.index] : undefined;
      switch (intent.type) {
        case 'focus':
          setFocus(intent.index);
          if (openId && slot) setOpen(slot.id);
          if (slot) rowRefs.current[slot.id]?.scrollIntoView({ block: 'nearest' });
          break;
        case 'open':
          if (slot) setOpen(slot.id);
          break;
        case 'sign-me-up':
          if (slot) void signMeUp(slot.id);
          break;
        case 'pick':
          if (slot) setPickerFor(slot.id);
          break;
        case 'clear':
          if (slot) void live.claim(slot.id, null);
          break;
        case 'undo':
          live.undoLast();
          break;
        case 'close':
          setOpen(null);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pickerSlot = pickerFor ? live.slots.find((s) => s.id === pickerFor) ?? null : null;
  const name = (id: string | null) => (id ? live.names[id] ?? '…' : null);
  let rowIndex = -1;

  return (
    <div className="b-page c-page">
      <header className="b-top">
        <div>
          <h1>
            Marshalling<span className="b-tag">Beta</span>
          </h1>
          <div className="sub">
            {totals.total ? `${totals.filled} of ${totals.total} slots filled` : 'Marshal and umpire slots'} · signing up confirms
            the slot
          </div>
        </div>
        <div className="b-nav">
          <button type="button" className="b-btn" aria-pressed={openOnly} onClick={() => setOpenOnly((v) => !v)}>
            <span className={`b-dot ${openOnly ? 'ok' : 'unk'}`} />
            Open only
          </button>
        </div>
      </header>

      <div className="b-list">
        {props.error && <div className="b-empty">{props.error}</div>}
        {!props.error && groups.length === 0 && (
          <div className="b-empty">{openOnly && live.slots.length ? 'Every slot is filled.' : 'No marshalling slots are published.'}</div>
        )}
        {groups.map((ev) => (
          <section key={ev.key} aria-label={ev.event}>
            <div className="c-event">
              <span>{ev.event}</span>
              <span className="b-mono">
                {ev.filled}/{ev.total}
              </span>
            </div>
            {ev.days.map((d) => (
              <section key={d.key} aria-label={d.label}>
                <div className="b-day">
                  <span>{d.label}</span>
                  <span>
                    {d.filled}/{d.total}
                  </span>
                </div>
                {d.shifts.map((sh) => (
                  <div key={sh.key} role="group" aria-label={`Shift ${sh.shift}`}>
                    <div className="c-shift">
                      <span>{sh.shift}</span>
                    </div>
                    {sh.slots.map((s) => {
                      const i = ++rowIndex;
                      const start = s.start_at ? new Date(s.start_at) : null;
                      const end = s.end_at ? new Date(s.end_at) : null;
                      const pending = Boolean(live.pending[s.id]);
                      const isMe = Boolean(actorId && s.person_id === actorId);
                      return (
                        <div
                          key={s.id}
                          ref={(el) => {
                            rowRefs.current[s.id] = el;
                          }}
                          role="button"
                          tabIndex={0}
                          aria-current={s.id === openId}
                          aria-label={`${s.role ?? 'Slot'} ${s.shift ?? ''} ${s.location ?? ''}: ${s.person_id ? name(s.person_id) : 'open'}`}
                          className={`c-mrow${i === focus ? ' focus' : ''}${live.flash[s.id] ? ' b-flash' : ''}${pending ? ' pending' : ''}`}
                          onClick={() => {
                            setFocus(i);
                            setOpen(s.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.target === e.currentTarget) {
                              e.stopPropagation();
                              setFocus(i);
                              setOpen(s.id);
                            }
                          }}
                        >
                          <span className="b-mono">
                            {start ? (s.all_day ? 'All day' : hhmm(start)) : '—'}
                            {start && end && !s.all_day && <span className="c-end">–{hhmm(end)}</span>}
                          </span>
                          <span className="nm">
                            {s.location ?? s.name}
                            <span className="c-role">{s.role ?? ''}</span>
                          </span>
                          <span className="c-clash" title={s.clash_crews.length ? 'Rowers in these crews cannot take this slot' : undefined}>
                            {s.clash_crews.length > 0 && (
                              <>
                                <span className="b-dot no" />
                                {s.clash_crews.join(', ')}
                              </>
                            )}
                          </span>
                          <span className="c-person">
                            {s.person_id ? (
                              <Status tone={personTone(s)} text={`${name(s.person_id)}${isMe ? ' (you)' : ''}`} />
                            ) : (
                              <span className="b-muted">Open</span>
                            )}
                          </span>
                          <span className="c-act">
                            {!s.person_id && (
                              <button
                                type="button"
                                className="b-btn c-sm"
                                disabled={pending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFocus(i);
                                  void signMeUp(s.id);
                                }}
                              >
                                Sign me up
                              </button>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </section>
            ))}
          </section>
        ))}
      </div>
      <div className="b-keys c-pagekeys" aria-hidden="true">
        <span>
          <kbd>J</kbd>
          <kbd>K</kbd> move
        </span>
        <span>
          <kbd>↵</kbd> open
        </span>
        <span>
          <kbd>S</kbd> sign me up
        </span>
        <span>
          <kbd>A</kbd> someone else
        </span>
        <span>
          <kbd>⌘Z</kbd> undo
        </span>
      </div>

      {openId && (
        <SlotDrawer
          key={openId}
          slot={open}
          personName={open ? name(open.person_id) : null}
          pending={Boolean(open && live.pending[open.id])}
          isMe={Boolean(open && actorId && open.person_id === actorId)}
          onSignMeUp={() => open && void signMeUp(open.id)}
          onPick={() => open && setPickerFor(open.id)}
          onClear={() => open && void live.claim(open.id, null)}
          onClose={() => setOpen(null)}
        />
      )}

      {pickerSlot && (
        <MarshalPicker
          context={[pickerSlot.shift, pickerSlot.location].filter(Boolean).join(' · ') || pickerSlot.name}
          currentId={pickerSlot.person_id}
          onClose={() => setPickerFor(null)}
          onClear={() => {
            setPickerFor(null);
            void live.claim(pickerSlot.id, null);
          }}
          onChooseMember={(m) => {
            setPickerFor(null);
            if (m.id !== pickerSlot.person_id) void live.claim(pickerSlot.id, m.id, m.name);
          }}
          onAddGuest={(guest) => {
            setPickerFor(null);
            void addGuest(pickerSlot.id, guest);
          }}
        />
      )}
    </div>
  );
}
