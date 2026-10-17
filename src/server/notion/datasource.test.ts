import { beforeEach, describe, expect, it, vi } from 'vitest';

const notionRequest = vi.fn();
vi.mock('./client', () => ({ notionRequest }));

async function loadGetDataSourceId() {
  vi.resetModules();
  return (await import('./datasource')).getDataSourceId;
}

const rateLimited = Object.assign(new Error('You have been rate limited. Please try again later.'), {
  code: 'rate_limited',
  status: 429,
});

describe('getDataSourceId', () => {
  beforeEach(() => notionRequest.mockReset());

  it('resolves the known SABC databases without calling Notion', async () => {
    const getDataSourceId = await loadGetDataSourceId();

    expect(await getDataSourceId('23d80040a8fa80edafaff6c83477d5d0')).toBe('23d80040-a8fa-80e1-a538-000bc51d1f0d');
    expect(await getDataSourceId('23d80040-a8fa-80c0-8319-d48a416d0d3b')).toBe('23d80040-a8fa-80cc-8b43-000ba4901edf');
    expect(await getDataSourceId('27a80040-a8fa-804a-9f8b-d536dcc548a7')).toBe('27a80040-a8fa-80ee-b4d6-000b500d815b');
    expect(await getDataSourceId('27980040a8fa8050a61ce835396544f4')).toBe('27980040-a8fa-80a1-b1b5-000b57b26287');
    expect(await getDataSourceId('a7d958881fd84cbe92c80f3d659391fd')).toBe('930f9a4b-c9d9-498a-be7b-f88e7ae85931');
    expect(notionRequest).not.toHaveBeenCalled();
  });

  it('does not cache the database id when the lookup is rate limited', async () => {
    const getDataSourceId = await loadGetDataSourceId();
    const unknownDb = '11111111222233334444555555555555';

    notionRequest.mockRejectedValueOnce(rateLimited);
    await expect(getDataSourceId(unknownDb)).rejects.toThrow('rate limited');

    notionRequest.mockResolvedValueOnce({ data_sources: [{ id: 'ds-resolved' }] });
    expect(await getDataSourceId(unknownDb)).toBe('ds-resolved');
    expect(notionRequest).toHaveBeenCalledTimes(2);
  });

  it('caches a successful lookup', async () => {
    const getDataSourceId = await loadGetDataSourceId();
    const unknownDb = '11111111222233334444555555555555';

    notionRequest.mockResolvedValueOnce({ data_sources: [{ id: 'ds-resolved' }] });
    await getDataSourceId(unknownDb);
    await getDataSourceId(unknownDb);
    expect(notionRequest).toHaveBeenCalledTimes(1);
  });
});
