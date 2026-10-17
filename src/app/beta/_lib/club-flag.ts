// Flag status (beta): the OURCS Isis flag as /api/flag-status returns it, and what each flag means
// for SABC outings. The rules text is the current outing drawer's (OutingDrawer "Requirements");
// the bank-rider rule is the one the auto-confirm SQL applies (recompute_outing_status, W2).

export type FlagData = {
  status_text?: string;
  notices?: string | string[];
  set_date?: string;
  set_by?: string;
};

export type FlagColour = 'Green' | 'Light Blue' | 'Dark Blue' | 'Amber' | 'Red' | 'Black' | 'Grey';

const COLOURS: FlagColour[] = ['Green', 'Light Blue', 'Dark Blue', 'Amber', 'Red', 'Black', 'Grey'];

/** "Light Blue Flag" / "light blue" → 'Light Blue'; unknown → null. */
export function flagColour(statusText: string | null | undefined): FlagColour | null {
  const t = (statusText ?? '').replace(/\s*flag\s*$/i, '').trim().toLowerCase();
  return COLOURS.find((c) => c.toLowerCase() === t) ?? null;
}

/** Swatch colours (the flags themselves, not the UI palette). */
export const FLAG_SWATCH: Record<FlagColour, string> = {
  Green: '#2f9e5b',
  'Light Blue': '#7cc4f0',
  'Dark Blue': '#1f3f8f',
  Amber: '#e8a317',
  Red: '#d44c47',
  Black: '#1f1f1f',
  Grey: '#a5a4a0',
};

export const LOCKKEEPER = '01865 777 277';
export const REGISTER_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSe6Lkd2v323rhEmIKbHIBjJ8ew1aR2YaJY416xoleVR3y1pZg/viewform';

export type FlagRules = {
  /** One line, as the current drawer shows it. */
  summary: string;
  /** Who needs a bank rider for a water outing to confirm. */
  bankRider: string;
  /** Whether crews may go out at all. */
  crewsOut: boolean;
  /** Light Blue: outings with novice coxes must be registered (form link). */
  register: boolean;
};

export const FLAG_RULES: Record<FlagColour, FlagRules> = {
  Green: {
    summary: 'Novice coxes must have a bank rider.',
    bankRider: 'Required when the cox is a Novice (including less than one term).',
    crewsOut: true,
    register: false,
  },
  'Light Blue': {
    summary:
      "Only Experienced and Senior coxes may go out. Novice coxes with more than one term's experience may go out with senior crews in daylight hours only, accompanied by a bank rider with a throw-line and the lockkeeper's number, with crew and bank rider registered more than 2 hours before the outing.",
    bankRider: 'Required when the cox is a Novice.',
    crewsOut: true,
    register: true,
  },
  'Dark Blue': {
    summary: 'No Novice or unregistered coxes.',
    bankRider: 'Not required by the club rules; Novice coxes cannot go out.',
    crewsOut: true,
    register: false,
  },
  Amber: {
    summary:
      "Senior coxes may go out only with senior crews. All crews must be accompanied by a bank rider with a throw-line and the lockkeeper's number.",
    bankRider: 'Required for every water outing.',
    crewsOut: true,
    register: false,
  },
  Red: { summary: 'No crews are allowed out.', bankRider: 'No water outings.', crewsOut: false, register: false },
  Black: { summary: 'No crews are allowed out.', bankRider: 'No water outings.', crewsOut: false, register: false },
  Grey: {
    summary: 'Flag not currently being maintained. Anyone is allowed to cox.',
    bankRider: 'Not required.',
    crewsOut: true,
    register: false,
  },
};

export function noticeList(notices: FlagData['notices']): string[] {
  if (Array.isArray(notices)) return notices.filter((n) => typeof n === 'string' && n.trim()).map((n) => n.trim());
  return typeof notices === 'string' && notices.trim() ? [notices.trim()] : [];
}

const setFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** "Sat 10 Oct, 10:48" (London), or null for a missing/invalid date. */
export function setAtLabel(setDate: string | undefined): string | null {
  if (!setDate) return null;
  const d = new Date(setDate);
  return Number.isNaN(d.getTime()) ? null : setFmt.format(d).replace(',', '');
}
