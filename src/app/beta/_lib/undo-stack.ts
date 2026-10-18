// The crew drawer's undo history: seat changes and report saves share one stack, so ⌘Z undoes
// whichever was most recent. Each entry undoes once, from ⌘Z or from its toast's Undo button.

export type UndoAction = { undo: () => void | Promise<void> };
export type UndoHandle = { undo: () => void };

export type UndoStack = {
  /** Record an action; the handle undoes it (once) and takes it off the stack, e.g. from a toast. */
  push: (action: UndoAction) => UndoHandle;
  /** Undo the most recent action still on the stack. False when there is none. */
  undoLast: () => boolean;
  size: () => number;
  clear: () => void;
};

export function createUndoStack(): UndoStack {
  let entries: UndoAction[] = [];
  const run = (entry: UndoAction) => {
    if (!entries.includes(entry)) return;
    entries = entries.filter((e) => e !== entry);
    void entry.undo();
  };
  return {
    push(action) {
      const entry = { undo: action.undo };
      entries.push(entry);
      return { undo: () => run(entry) };
    },
    undoLast() {
      const entry = entries[entries.length - 1];
      if (!entry) return false;
      run(entry);
      return true;
    },
    size: () => entries.length,
    clear() {
      entries = [];
    },
  };
}
