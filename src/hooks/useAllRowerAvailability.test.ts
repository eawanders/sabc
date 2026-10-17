import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RowerWeeklyAvailability } from '@/types/rowerAvailability';

function week(memberId: string, monday: RowerWeeklyAvailability['monday'] = []): RowerWeeklyAvailability {
  return { memberId, monday, tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] };
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

async function loadModule() {
  vi.resetModules();
  return import('@/hooks/useAllRowerAvailability');
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('loadAllRowerAvailability', () => {
  it('makes exactly one request for all members, and dedupes concurrent callers', async () => {
    const all = Array.from({ length: 104 }, (_, i) => week(`m-${i}`));
    const fetchMock = vi.fn(async () => jsonResponse({ availability: all, success: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { loadAllRowerAvailability } = await loadModule();

    const [home, drawer] = await Promise.all([loadAllRowerAvailability(), loadAllRowerAvailability()]);
    const again = await loadAllRowerAvailability();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/get-all-rower-availability');
    expect(home.size).toBe(104);
    expect(drawer).toBe(home);
    expect(again).toBe(home);
    expect(home.get('m-0')).toEqual({ monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] });
  });

  it('rejects on a failed load instead of returning an empty (all-available) map, and does not cache the failure', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'Failed', success: false }, false))
      .mockResolvedValueOnce(jsonResponse({ availability: [week('m-1')], success: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { loadAllRowerAvailability } = await loadModule();

    await expect(loadAllRowerAvailability()).rejects.toThrow();
    const retried = await loadAllRowerAvailability();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(retried.has('m-1')).toBe(true);
  });

  it('refetches when forced', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ availability: [week('m-1')], success: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { loadAllRowerAvailability } = await loadModule();

    await loadAllRowerAvailability();
    await loadAllRowerAvailability(true);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('setCachedMemberAvailability', () => {
  it('replaces a member’s week in the cached map without a refetch', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ availability: [week('m-1')], success: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { loadAllRowerAvailability, setCachedMemberAvailability } = await loadModule();

    await loadAllRowerAvailability();
    setCachedMemberAvailability(week('m-1', [{ start: '18:00', end: '20:00' }]));
    const map = await loadAllRowerAvailability();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(map.get('m-1')?.monday).toEqual([{ start: '18:00', end: '20:00' }]);
  });
});
