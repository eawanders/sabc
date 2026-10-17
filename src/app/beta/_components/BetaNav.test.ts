import { describe, expect, it } from 'vitest';
import { BETA_SECTIONS, isActive } from './BetaNav';

describe('beta nav', () => {
  it('marks Home only on /beta itself', () => {
    expect(isActive('/beta', '/beta')).toBe(true);
    expect(isActive('/beta/schedule', '/beta')).toBe(false);
  });
  it('marks a section for its sub-pages', () => {
    expect(isActive('/beta/schedule', '/beta/schedule')).toBe(true);
    expect(isActive('/beta/schedule/abc', '/beta/schedule')).toBe(true);
    expect(isActive('/beta/schedulex', '/beta/schedule')).toBe(false);
  });
  it('lists every section once, all under /beta', () => {
    const hrefs = BETA_SECTIONS.map((s) => s.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.every((h) => h === '/beta' || h.startsWith('/beta/'))).toBe(true);
  });
});
