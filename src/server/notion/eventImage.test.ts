import { beforeEach, describe, expect, it, vi } from 'vitest';

const notionRequest = vi.fn();
vi.mock('./client', () => ({ notionRequest }));

const { resolveEventImage } = await import('./eventImage');

const EVENT = '27f80040-a8fa-809d-b1a3-ddd0df551c58';
const EVENTS_DS = '27a80040-a8fa-80ee-b4d6-000b500d815b';
const NOW = Date.parse('2026-10-18T09:00:00Z');

const stale = { name: 'IMG_4998.JPG', type: 'file', file: { url: 'https://prod-files-secure.s3.us-west-2.amazonaws.com/a/IMG_4998.JPG?sig=old', expiry_time: '2026-10-17T10:00:00Z' } };
const fresh = { name: 'IMG_4998.JPG', type: 'file', file: { url: 'https://prod-files-secure.s3.us-west-2.amazonaws.com/a/IMG_4998.JPG?sig=new', expiry_time: '2026-10-18T10:00:00Z' } };
const form = { name: 'https://docs.google.com/forms/d/e/x/viewform', type: 'external', external: { url: 'https://docs.google.com/forms/d/e/x/viewform' } };
const poster = { name: 'poster', type: 'external', external: { url: 'https://example.com/poster.png' } };

const page = (files: unknown[], ds = EVENTS_DS) => ({ parent: { type: 'data_source_id', data_source_id: ds }, properties: { 'Files & media': { files } } });

describe('resolveEventImage', () => {
  beforeEach(() => notionRequest.mockReset());

  it('redirects to a fresh Notion URL, cached well inside its expiry', async () => {
    notionRequest.mockResolvedValueOnce(page([fresh, form]));
    const r = await resolveEventImage(EVENT, '0', async () => [stale, form], NOW);
    expect(r).toEqual({ status: 302, location: fresh.file.url, cacheControl: 'public, max-age=300, s-maxage=2700, stale-while-revalidate=300' });
    expect(notionRequest).toHaveBeenCalledWith({ method: 'get', path: `pages/${EVENT}` }, 'pages/:event-image');
  });

  it('redirects to an external image without calling Notion', async () => {
    const r = await resolveEventImage(EVENT, '1', async () => [form, poster], NOW);
    expect(r).toMatchObject({ status: 302, location: 'https://example.com/poster.png' });
    expect(notionRequest).not.toHaveBeenCalled();
  });

  it('404s bad ids, unknown events, out-of-range or non-image entries, without calling Notion', async () => {
    const files = async () => [stale, form];
    for (const [id, i] of [
      ['not-a-uuid', '0'],
      [EVENT.toUpperCase(), '0'],
      [EVENT, '-1'],
      [EVENT, '1.5'],
      [EVENT, '999'],
      [EVENT, '2'], // out of range
      [EVENT, '1'], // the form link, not an image
    ]) {
      expect((await resolveEventImage(id, i, files, NOW)).status, `${id}/${i}`).toBe(404);
    }
    expect((await resolveEventImage(EVENT, '0', async () => undefined, NOW)).status).toBe(404);
    expect(notionRequest).not.toHaveBeenCalled();
  });

  it('404s a page outside the Events data source, or a file no longer an image in Notion', async () => {
    notionRequest.mockResolvedValueOnce(page([fresh], 'some-other-ds'));
    expect((await resolveEventImage(EVENT, '0', async () => [stale], NOW)).status).toBe(404);
    notionRequest.mockResolvedValueOnce(page([form]));
    expect((await resolveEventImage(EVENT, '0', async () => [stale], NOW)).status).toBe(404);
    notionRequest.mockResolvedValueOnce(page([]));
    expect((await resolveEventImage(EVENT, '0', async () => [stale], NOW)).status).toBe(404);
  });

  it('502s, uncached, when the database or Notion fails', async () => {
    expect(await resolveEventImage(EVENT, '0', async () => Promise.reject(new Error('db')), NOW)).toEqual({ status: 502, cacheControl: 'no-store' });
    notionRequest.mockRejectedValueOnce(Object.assign(new Error('rate limited'), { status: 429 }));
    expect(await resolveEventImage(EVENT, '0', async () => [stale], NOW)).toEqual({ status: 502, cacheControl: 'no-store' });
  });
});
