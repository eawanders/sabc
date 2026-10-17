import { afterEach, describe, expect, it, vi } from 'vitest';
import { RowerWeeklyAvailability } from '@/types/rowerAvailability';

vi.mock('@/hooks/useAllRowerAvailability', () => ({
  setCachedMemberAvailability: vi.fn(),
}));

import {
  canEditAvailability,
  cacheSavedAvailability,
  getCachedAvailability,
  loadRowerAvailability,
} from '@/hooks/useRowerAvailability';
import { setCachedMemberAvailability } from '@/hooks/useAllRowerAvailability';

function week(memberId: string, monday: RowerWeeklyAvailability['monday'] = []): RowerWeeklyAvailability {
  return { memberId, monday, tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

function setters() {
  return { setAvailability: vi.fn(), setLoading: vi.fn(), setError: vi.fn() };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('canEditAvailability', () => {
  const loaded = week('member-a', [{ start: '09:00', end: '10:00' }]);
  const base = { selectedMemberId: 'member-a', availability: loaded, localAvailability: loaded, loading: false, fetchError: null };

  it('allows editing once the selected member’s data has loaded', () => {
    expect(canEditAvailability(base)).toBe(true);
  });

  it('blocks editing when the fetch failed, so an empty grid cannot be saved over real data', () => {
    expect(canEditAvailability({ ...base, availability: null, localAvailability: week('member-a'), fetchError: 'Failed' })).toBe(false);
  });

  it('blocks editing when nothing has loaded for the selected member', () => {
    expect(canEditAvailability({ ...base, availability: null })).toBe(false);
    expect(canEditAvailability({ ...base, localAvailability: null })).toBe(false);
    expect(canEditAvailability({ ...base, selectedMemberId: null })).toBe(false);
  });

  it('blocks editing while loading', () => {
    expect(canEditAvailability({ ...base, loading: true })).toBe(false);
  });

  it('blocks editing when the data shown belongs to a different member', () => {
    expect(canEditAvailability({ ...base, selectedMemberId: 'member-b' })).toBe(false);
    expect(canEditAvailability({ ...base, localAvailability: week('member-b') })).toBe(false);
  });
});

describe('loadRowerAvailability', () => {
  it('ignores a slower response for a member that is no longer selected', async () => {
    const a = deferred<Response>();
    const b = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn((url: string) => (url.includes('race-a') ? a.promise : b.promise)));

    let current = 'race-a';
    const s = setters();
    const loadA = loadRowerAvailability('race-a', false, () => current === 'race-a', s);
    current = 'race-b';
    const loadB = loadRowerAvailability('race-b', false, () => current === 'race-b', s);

    b.resolve(jsonResponse({ availability: week('race-b') }));
    await loadB;
    a.resolve(jsonResponse({ availability: week('race-a', [{ start: '06:00', end: '07:00' }]) }));
    await loadA;

    expect(s.setAvailability).toHaveBeenCalledTimes(1);
    expect(s.setAvailability).toHaveBeenLastCalledWith(week('race-b'));
    expect(s.setLoading).toHaveBeenLastCalledWith(false);
  });

  it('ignores a stale failure for a member that is no longer selected', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'boom' }, false)));

    const s = setters();
    await loadRowerAvailability('stale-fail', false, () => false, s);

    expect(s.setError).not.toHaveBeenCalledWith('boom');
    expect(s.setAvailability).not.toHaveBeenCalled();
  });

  it('clears a previous member’s error when serving from cache', async () => {
    cacheSavedAvailability(week('cached-member'));
    vi.stubGlobal('fetch', vi.fn());

    const s = setters();
    await loadRowerAvailability('cached-member', false, () => true, s);

    expect(fetch).not.toHaveBeenCalled();
    expect(s.setError).toHaveBeenCalledWith(null);
    expect(s.setAvailability).toHaveBeenCalledWith(week('cached-member'));
  });
});

describe('cacheSavedAvailability', () => {
  it('writes the saved week into both availability caches', () => {
    const saved = week('saved-member', [{ start: '18:00', end: '20:00' }]);
    cacheSavedAvailability(saved);

    expect(getCachedAvailability('saved-member')).toEqual(saved);
    expect(setCachedMemberAvailability).toHaveBeenCalledWith(saved);
  });

  it('replaces an older cached week so re-selecting shows the saved values', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ availability: week('reselect') })));
    const s = setters();
    await loadRowerAvailability('reselect', false, () => true, s);

    const saved = week('reselect', [{ start: '00:00', end: '23:59' }]);
    cacheSavedAvailability(saved);

    const again = setters();
    await loadRowerAvailability('reselect', false, () => true, again);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(again.setAvailability).toHaveBeenCalledWith(saved);
  });
});
