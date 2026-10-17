import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/api/_utils/logger', () => ({ default: { warn: vi.fn() } }));

import { getFlagStatusText, resetFlagStatusCache } from './flagStatus';

describe('getFlagStatusText', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    resetFlagStatusCache();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns status_text and caches it for 60 s', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 'G', status_text: 'Green' })));
    expect(await getFlagStatusText(1_000)).toBe('Green');
    expect(await getFlagStatusText(60_000)).toBe('Green');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status_text: 'Light Blue' })));
    expect(await getFlagStatusText(61_001)).toBe('Light Blue');
  });

  it('is null when the flag service fails', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'));
    expect(await getFlagStatusText(1_000)).toBeNull();
    fetchMock.mockResolvedValue(new Response('nope', { status: 503 }));
    expect(await getFlagStatusText(100_000)).toBeNull();
  });
});
