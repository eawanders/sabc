'use client';
// A slot's outcome: the status chip and its small menu (1 Passed · 2 Failed · 3 No show · 4 Booked).
import { useEffect, useRef, useState } from 'react';
import { pickerKey } from '../_lib/keyboard';
import { KEY_OUTCOME } from '../_lib/tests-keyboard';
import type { Outcome } from '../_lib/tests-state';

const MENU = (Object.entries(KEY_OUTCOME) as [string, Outcome][]).map(([key, outcome]) => ({ key, outcome }));

const TONE: Record<string, string> = { Passed: 'ok', Failed: 'no', 'No Show': 'unk', 'Test Booked': 'booked' };
const TEXT: Record<string, string> = { Passed: 'Passed', Failed: 'Failed', 'No Show': 'No show', 'Test Booked': 'Booked' };

export function OutcomeStatus({ outcome }: { outcome: string | null }) {
  return (
    <span className="b-st">
      <span className={`b-dot ${TONE[outcome ?? ''] ?? 'unk'}`} />
      {TEXT[outcome ?? ''] ?? 'No outcome'}
    </span>
  );
}

export function OutcomeMenu(props: { current: string | null; onChoose: (o: Outcome) => void; onClose: () => void }) {
  const start = Math.max(0, MENU.findIndex((m) => m.outcome === props.current));
  const [idx, setIdx] = useState(start);
  const ref = useRef<HTMLDivElement>(null);
  const onClose = useRef(props.onClose);
  onClose.current = props.onClose;

  useEffect(() => {
    ref.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose.current();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  return (
    <div
      ref={ref}
      className="bt-menu"
      role="menu"
      aria-label="Outcome"
      tabIndex={-1}
      onKeyDown={(e) => {
        const direct = MENU.find((m) => m.key === e.key);
        if (direct) {
          e.preventDefault();
          e.stopPropagation();
          props.onChoose(direct.outcome);
          return;
        }
        const intent = pickerKey(e.key, { index: idx, count: MENU.length });
        if (!intent) return;
        e.preventDefault();
        e.stopPropagation();
        if (intent.type === 'move') setIdx(intent.index);
        else if (intent.type === 'choose') props.onChoose(MENU[intent.index].outcome);
        else props.onClose();
      }}
    >
      {MENU.map((m, i) => (
        <button
          key={m.outcome}
          type="button"
          role="menuitemradio"
          aria-checked={m.outcome === props.current}
          className={`b-opt${i === idx ? ' kb' : ''}`}
          onMouseMove={() => setIdx(i)}
          onClick={() => props.onChoose(m.outcome)}
        >
          <span className={`b-dot ${TONE[m.outcome]}`} />
          <span className="n">{TEXT[m.outcome]}</span>
          <span className="s">
            <kbd>{m.key}</kbd>
          </span>
        </button>
      ))}
    </div>
  );
}
