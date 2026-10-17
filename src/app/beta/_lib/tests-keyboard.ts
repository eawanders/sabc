// Keyboard model of the test drawer: pure functions from a key press to an intent.
import type { KeyInput } from './keyboard';
import type { Outcome } from './tests-state';

export const KEY_OUTCOME: Record<'1' | '2' | '3' | '4', Outcome> = {
  '1': 'Passed',
  '2': 'Failed',
  '3': 'No Show',
  '4': 'Test Booked',
};

export type TestDrawerIntent =
  | { type: 'focus'; index: number }
  | { type: 'open-picker'; index: number }
  | { type: 'set-outcome'; index: number; outcome: Outcome }
  | { type: 'clear'; index: number }
  | { type: 'book-me' }
  | { type: 'undo' }
  | { type: 'close' };

/**
 * Slot list keys (no picker or menu open, focus not in a text field):
 *   J / ↓, K / ↑ move · Enter opens the picker · 1 Passed, 2 Failed, 3 No show, 4 Booked (filled slots)
 *   Backspace clears (filled slots) · B books you in the first free slot · ⌘Z / Ctrl+Z undo · Esc close
 */
export function testDrawerKey(
  input: KeyInput,
  ctx: { focus: number; count: number; filled: (index: number) => boolean },
): TestDrawerIntent | null {
  const { key } = input;
  const mod = input.meta || input.ctrl;
  if (mod && !input.shift && !input.alt && key.toLowerCase() === 'z') return { type: 'undo' };
  if (mod || input.alt) return null;
  const last = Math.max(0, ctx.count - 1);
  switch (key) {
    case 'j':
    case 'ArrowDown':
      return { type: 'focus', index: Math.min(last, ctx.focus + 1) };
    case 'k':
    case 'ArrowUp':
      return { type: 'focus', index: Math.max(0, ctx.focus - 1) };
    case 'Enter':
      return ctx.count > 0 ? { type: 'open-picker', index: ctx.focus } : null;
    case 'Escape':
      return { type: 'close' };
    case 'b':
      return { type: 'book-me' };
    case '1':
    case '2':
    case '3':
    case '4':
      return ctx.count > 0 && ctx.filled(ctx.focus) ? { type: 'set-outcome', index: ctx.focus, outcome: KEY_OUTCOME[key] } : null;
    case 'Backspace':
    case 'Delete':
      return ctx.count > 0 && ctx.filled(ctx.focus) ? { type: 'clear', index: ctx.focus } : null;
    default:
      return null;
  }
}
