// Keyboard model of the crew drawer: pure functions from a key press to an intent.
import { KEY_STATUS } from './seats';

export type KeyInput = { key: string; meta?: boolean; ctrl?: boolean; shift?: boolean; alt?: boolean };

export type DrawerIntent =
  | { type: 'focus'; index: number }
  | { type: 'open-picker'; index: number }
  | { type: 'set-status'; index: number; status: string }
  | { type: 'clear'; index: number }
  | { type: 'undo' }
  | { type: 'close' };

/**
 * Seat list keys (no picker open, focus not in a text field):
 *   J / ↓, K / ↑ move · Enter opens the picker · 1/2/3 set Available/Maybe/Can't (filled seats)
 *   Backspace clears (filled seats) · ⌘Z / Ctrl+Z undoes your last change · Esc closes the drawer
 */
export function drawerKey(
  input: KeyInput,
  ctx: { focus: number; count: number; filled: (index: number) => boolean },
): DrawerIntent | null {
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
      return { type: 'open-picker', index: ctx.focus };
    case 'Escape':
      return { type: 'close' };
    case '1':
    case '2':
    case '3':
      return ctx.filled(ctx.focus) ? { type: 'set-status', index: ctx.focus, status: KEY_STATUS[key] } : null;
    case 'Backspace':
    case 'Delete':
      return ctx.filled(ctx.focus) ? { type: 'clear', index: ctx.focus } : null;
    default:
      return null;
  }
}

export type PickerIntent = { type: 'move'; index: number } | { type: 'choose'; index: number } | { type: 'close' };

/** Palette keys: ↑/↓ move the highlight over `count` selectable rows, Enter chooses, Esc closes. */
export function pickerKey(key: string, ctx: { index: number; count: number }): PickerIntent | null {
  const last = Math.max(0, ctx.count - 1);
  switch (key) {
    case 'ArrowDown':
      return { type: 'move', index: Math.min(last, ctx.index + 1) };
    case 'ArrowUp':
      return { type: 'move', index: Math.max(0, ctx.index - 1) };
    case 'Enter':
      return ctx.count > 0 ? { type: 'choose', index: Math.min(ctx.index, last) } : null;
    case 'Escape':
      return { type: 'close' };
    default:
      return null;
  }
}
