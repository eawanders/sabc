import { describe, expect, it } from 'vitest';
import type { UnavailabilityRow } from '@/lib/live/types';
import { saveUnavailabilitySchema } from '@/lib/live/schemas';
import {
  canAdd,
  canEdit,
  dayError,
  daysFromRow,
  editorReducer,
  emptyWeek,
  initialEditor,
  isDirty,
  isWholeDay,
  nextRange,
  rangeIssue,
  sameWeek,
  sortRanges,
  swipeStep,
  weekEffect,
  weekIsValid,
  WHOLE_DAY,
  type EditorAction,
  type EditorState,
} from './availability-edit';

const ADA = '00000000-0000-4000-8000-000000000001';
const BEN = '00000000-0000-4000-8000-000000000002';

function row(memberId: string, version: number, patch: Partial<UnavailabilityRow> = {}): UnavailabilityRow {
  return {
    member_id: memberId,
    ...emptyWeek(),
    version,
    updated_by: memberId,
    updated_at: '2026-10-18T10:00:00Z',
    ...patch,
  };
}

const run = (actions: EditorAction[], from: EditorState = initialEditor) => actions.reduce(editorReducer, from);

describe('availability rules', () => {
  it('reads a row into seven days, dropping malformed entries', () => {
    const days = daysFromRow({ monday: [{ start: '09:00', end: '12:00' }, { start: 9 }, null], tuesday: 'x' } as never);
    expect(days.monday).toEqual([{ start: '09:00', end: '12:00' }]);
    expect(days.tuesday).toEqual([]);
    expect(daysFromRow(null)).toEqual(emptyWeek());
  });

  it('names what is wrong with each range, as validateDayRanges judges it', () => {
    const day = [
      { start: '07:00', end: '09:00' },
      { start: '08:30', end: '10:00' },
      { start: '12:00', end: '11:00' },
    ];
    expect(rangeIssue(day, 0)).toBe('overlap');
    expect(rangeIssue(day, 1)).toBe('overlap');
    expect(rangeIssue(day, 2)).toBe('order');
    expect(rangeIssue([{ start: '', end: '09:00' }], 0)).toBe('format');
    expect(dayError(day)).toBe('Times overlap. Merge or move them.');
    expect(dayError([{ start: '09:00', end: '09:00' }])).toBe('End must be after start.');
    expect(dayError([{ start: '07:00', end: '09:00' }, { start: '09:00', end: '10:00' }])).toBeNull(); // touching is fine
    expect(dayError(Array(4).fill({ start: '01:00', end: '02:00' }))).toBe('At most 3 ranges a day.');
  });

  it('agrees with the server schema on what may be saved', () => {
    const ok = { ...emptyWeek(), monday: [{ start: '07:00', end: '09:00' }] };
    const bad = { ...emptyWeek(), monday: [{ start: '07:00', end: '09:00' }, { start: '08:00', end: '10:00' }] };
    const body = (days: object) => ({ memberId: ADA, days, actorId: ADA, expectedVersion: 0 });
    expect(weekIsValid(ok)).toBe(true);
    expect(saveUnavailabilitySchema.safeParse(body(ok)).success).toBe(true);
    expect(weekIsValid(bad)).toBe(false);
    expect(saveUnavailabilitySchema.safeParse(body(bad)).success).toBe(false);
  });

  it('suggests a sensible next range and only allows additions that keep the day valid', () => {
    expect(nextRange([])).toEqual({ start: '09:00', end: '17:00' });
    expect(nextRange([{ start: '07:00', end: '09:00' }])).toEqual({ start: '09:00', end: '11:00' });
    expect(nextRange([{ start: '22:30', end: '23:30' }])).toEqual({ start: '23:00', end: '23:59' });
    expect(canAdd([{ start: '07:00', end: '09:00' }], { start: '08:00', end: '10:00' })).toBe(false);
    expect(canAdd([{ start: '07:00', end: '09:00' }], { start: '17:00', end: '21:00' })).toBe(true);
    expect(canAdd([{ start: '07:00', end: '09:00' }], { start: '07:00', end: '09:00' })).toBe(false);
  });

  it('knows the whole-day range and sorts ranges by start', () => {
    expect(isWholeDay([WHOLE_DAY])).toBe(true);
    expect(isWholeDay([{ start: '00:00', end: '23:00' }])).toBe(false);
    expect(sortRanges([{ start: '17:00', end: '18:00' }, { start: '07:00', end: '08:00' }]).map((r) => r.start)).toEqual(['07:00', '17:00']);
  });

  it('turns a horizontal swipe into a day step and ignores scrolling', () => {
    expect(swipeStep(-80, 5)).toBe(1);
    expect(swipeStep(80, 5)).toBe(-1);
    expect(swipeStep(30, 0)).toBe(0);
    expect(swipeStep(-80, 70)).toBe(0);
  });

  it("counts the upcoming outings this week's ranges would mark unavailable or maybe", () => {
    // Mon 19 Oct 2026 07:00–08:30 London (BST) and Wed 21 Oct 17:00–18:00
    const outings = [
      { id: 'a', name: 'M1', start_at: '2026-10-19T06:00:00Z', end_at: '2026-10-19T07:30:00Z' },
      { id: 'b', name: 'W1', start_at: '2026-10-21T16:00:00Z', end_at: '2026-10-21T17:00:00Z' },
      { id: 'c', name: 'Past', start_at: '2026-10-12T06:00:00Z', end_at: '2026-10-12T07:00:00Z' },
    ];
    const days = { ...emptyWeek(), monday: [{ start: '06:00', end: '09:00' }], wednesday: [{ start: '17:30', end: '19:00' }] };
    const fx = weekEffect(days, outings, new Date('2026-10-18T12:00:00Z'));
    expect(fx.upcoming).toBe(2);
    expect(fx.unavailable.map((o) => o.id)).toEqual(['a']);
    expect(fx.maybe.map((o) => o.id)).toEqual(['b']);
  });
});

describe('editor state (PER-269: never edit or save the wrong data)', () => {
  const adaRow = row(ADA, 3, { monday: [{ start: '07:00', end: '09:00' }] });

  it('is not editable while loading or after a failed load', () => {
    const loading = run([{ type: 'select', memberId: ADA }]);
    expect(canEdit(loading, ADA)).toBe(false);
    const failed = run([{ type: 'failed', memberId: ADA }], loading);
    expect(failed.load).toBe('error');
    expect(failed.draft).toBeNull();
    expect(canEdit(failed, ADA)).toBe(false);
    // ...and edits are ignored rather than starting from an empty week
    expect(run([{ type: 'edit', day: 'monday', ranges: [] }], failed).draft).toBeNull();
  });

  it("drops a slow response for a member who is no longer selected", () => {
    const s = run([
      { type: 'select', memberId: ADA },
      { type: 'select', memberId: BEN },
      { type: 'loaded', memberId: ADA, row: adaRow },
    ]);
    expect(s.memberId).toBe(BEN);
    expect(s.load).toBe('loading');
    expect(canEdit(s, BEN)).toBe(false);
    expect(canEdit(s, ADA)).toBe(false);
  });

  it('treats a member with no row as an empty week at version 0', () => {
    const s = run([{ type: 'select', memberId: BEN }, { type: 'loaded', memberId: BEN, row: null }]);
    expect(canEdit(s, BEN)).toBe(true);
    expect(s.base?.version).toBe(0);
    expect(sameWeek(s.draft!, emptyWeek())).toBe(true);
  });

  it('tracks dirty state, discards, and adopts a saved row', () => {
    let s = run([{ type: 'select', memberId: ADA }, { type: 'loaded', memberId: ADA, row: adaRow }]);
    expect(isDirty(s)).toBe(false);
    s = run([{ type: 'edit', day: 'friday', ranges: [{ start: '17:00', end: '21:00' }] }], s);
    expect(isDirty(s)).toBe(true);
    expect(isDirty(run([{ type: 'discard' }], s))).toBe(false);
    s = run([{ type: 'save-start' }], s);
    expect(run([{ type: 'edit', day: 'monday', ranges: [] }], s).draft).toBe(s.draft); // locked while saving
    s = run([{ type: 'saved', memberId: ADA, row: { ...adaRow, version: 4, friday: [{ start: '17:00', end: '21:00' }] } }], s);
    expect(isDirty(s)).toBe(false);
    expect(s.base?.version).toBe(4);
    expect(s.saving).toBe(false);
  });

  it('applies Realtime rows when clean, keeps your edits and warns when dirty', () => {
    const clean = run([{ type: 'select', memberId: ADA }, { type: 'loaded', memberId: ADA, row: adaRow }]);
    const theirs = row(ADA, 4, { updated_by: BEN, tuesday: [{ start: '10:00', end: '11:00' }] });
    const applied = run([{ type: 'remote', row: theirs }], clean);
    expect(applied.base?.version).toBe(4);
    expect(applied.draft?.tuesday).toHaveLength(1);

    const dirty = run([{ type: 'edit', day: 'friday', ranges: [{ start: '17:00', end: '21:00' }] }], clean);
    const warned = run([{ type: 'remote', row: theirs }], dirty);
    expect(warned.staleBy).toBe(BEN);
    expect(warned.draft?.friday).toHaveLength(1); // your edits stay
    expect(warned.base?.version).toBe(3); // so a save is refused, not silently over theirs
    const reloaded = run([{ type: 'reload' }], warned);
    expect(reloaded.load).toBe('loading');
    expect(canEdit(reloaded, ADA)).toBe(false);

    // Rows for other members and old versions are ignored
    expect(run([{ type: 'remote', row: row(BEN, 9) }], clean)).toBe(clean);
    expect(run([{ type: 'remote', row: row(ADA, 2) }], clean)).toBe(clean);
  });

  it('takes the echo of your own save even if it beats the response', () => {
    const s = run([
      { type: 'select', memberId: ADA },
      { type: 'loaded', memberId: ADA, row: adaRow },
      { type: 'edit', day: 'friday', ranges: [{ start: '17:00', end: '21:00' }] },
      { type: 'save-start' },
      { type: 'remote', row: { ...adaRow, version: 4, friday: [{ start: '17:00', end: '21:00' }] } },
    ]);
    expect(s.staleBy).toBeUndefined();
    expect(s.base?.version).toBe(4);
    expect(isDirty(s)).toBe(false);
  });

  it('keeps the newer of a Realtime row seen while loading and the load result', () => {
    const s = run([
      { type: 'select', memberId: ADA },
      { type: 'remote', row: row(ADA, 5, { sunday: [WHOLE_DAY] }) },
      { type: 'loaded', memberId: ADA, row: adaRow },
    ]);
    expect(s.base?.version).toBe(5);
    expect(s.draft?.sunday).toEqual([WHOLE_DAY]);
  });

  it('on a conflict shows what is saved now, or reloads', () => {
    const dirty = run([
      { type: 'select', memberId: ADA },
      { type: 'loaded', memberId: ADA, row: adaRow },
      { type: 'edit', day: 'friday', ranges: [{ start: '17:00', end: '21:00' }] },
      { type: 'save-start' },
    ]);
    const current = row(ADA, 7, { updated_by: BEN });
    const s = run([{ type: 'conflict', memberId: ADA, current }], dirty);
    expect(s.base?.version).toBe(7);
    expect(isDirty(s)).toBe(false);
    expect(s.saving).toBe(false);
    const reload = run([{ type: 'conflict', memberId: ADA, current: null }], dirty);
    expect(reload.load).toBe('loading');
    expect(canEdit(reload, ADA)).toBe(false);
  });
});
