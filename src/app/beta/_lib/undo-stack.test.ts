import { describe, expect, it, vi } from 'vitest';
import { createUndoStack } from './undo-stack';

describe('undo stack', () => {
  it('undoes the most recent action first, whatever kind it was', () => {
    const stack = createUndoStack();
    const order: string[] = [];
    stack.push({ undo: () => void order.push('seat 1') });
    stack.push({ undo: () => void order.push('report save') });
    stack.push({ undo: () => void order.push('seat 2') });
    stack.push({ undo: () => void order.push('report save 2') });
    while (stack.undoLast()) {}
    expect(order).toEqual(['report save 2', 'seat 2', 'report save', 'seat 1']);
    expect(stack.size()).toBe(0);
  });

  it('a report save after a seat change is undone before the seat change', () => {
    const stack = createUndoStack();
    const seat = vi.fn();
    const report = vi.fn();
    stack.push({ undo: seat });
    stack.push({ undo: report });
    expect(stack.undoLast()).toBe(true);
    expect(report).toHaveBeenCalledOnce();
    expect(seat).not.toHaveBeenCalled();
  });

  it('an entry undone from its toast leaves the stack, keeping the rest in order', () => {
    const stack = createUndoStack();
    const order: string[] = [];
    const a = stack.push({ undo: () => void order.push('a') });
    const b = stack.push({ undo: () => void order.push('b') });
    stack.push({ undo: () => void order.push('c') });
    b.undo(); // via the toast button
    expect(order).toEqual(['b']);
    stack.undoLast();
    stack.undoLast();
    expect(order).toEqual(['b', 'c', 'a']);
    expect(stack.undoLast()).toBe(false);
    a.undo(); // already gone: a second undo of the same entry does nothing
    expect(order).toEqual(['b', 'c', 'a']);
  });

  it('reports an empty stack', () => {
    const stack = createUndoStack();
    expect(stack.undoLast()).toBe(false);
    stack.push({ undo: () => {} });
    stack.clear();
    expect(stack.undoLast()).toBe(false);
  });
});
