// What a crew needs before it can go out, shown in the drawer. Mirrors recompute_outing_status
// (supabase/migrations/20261018100100_live_write_rpcs.sql, rules W1/W2/N1/R1): the server decides,
// this only explains the decision to the person looking at the outing.
import type { SeatRow } from '@/lib/live/types';
import { BANK_RIDER, CREW_SEATS, SUB_SEATS } from '../../_lib/seats';

/** The flag as the rules compare it: lower-cased, first space to '-' ('Light Blue' → 'light-blue'). */
export function flagKey(flag: string | null | undefined): string {
  return (flag ?? '').toLowerCase().replace(' ', '-');
}

/**
 * W2: a water outing needs an Available bank rider when the flag is
 *   green and the cox is a novice ('Novice' or 'Novice (less than 1 term)'),
 *   light blue and the cox is 'Novice', or amber (any cox).
 * Unknown flag: no requirement (as the server judges it).
 */
export function bankRiderRequired(flag: string | null | undefined, coxExperience: string | null | undefined): boolean {
  const f = flagKey(flag);
  if (f === 'amber') return true;
  if (f === 'green') return coxExperience === 'Novice' || coxExperience === 'Novice (less than 1 term)';
  if (f === 'light-blue') return coxExperience === 'Novice';
  return false;
}

/** Red or black: no crews out. */
export function flagStopsOutings(flag: string | null | undefined): boolean {
  const f = flagKey(flag);
  return f === 'red' || f === 'black';
}

export type Requirement = { key: string; label: string; met: boolean };

type SeatView = Pick<SeatRow, 'member_id' | 'status'> | undefined;

/**
 * The checklist for auto-confirm. Water outings: nine crew Available, a bank rider if required, a
 * known flag that allows outings. Other types: everyone seated outside the subs is Available.
 */
export function confirmRequirements(opts: {
  type: string | null;
  flag: string | null;
  coxExperience: string | null;
  view: (seat: string) => SeatView;
}): Requirement[] {
  const { view } = opts;
  const available = (s: string) => Boolean(view(s)?.member_id) && view(s)?.status === 'Available';
  if (opts.type === 'Water Outing') {
    const ready = CREW_SEATS.filter(available).length;
    const reqs: Requirement[] = [{ key: 'crew', label: `Nine crew available (${ready}/9)`, met: ready === 9 }];
    if (bankRiderRequired(opts.flag, opts.coxExperience)) {
      reqs.push({ key: 'bank', label: `Bank rider available (${bankRiderReason(opts.flag, opts.coxExperience)})`, met: available(BANK_RIDER) });
    }
    reqs.push({
      key: 'flag',
      label: !opts.flag ? 'River flag known' : flagStopsOutings(opts.flag) ? `${opts.flag} flag: no crews out` : `${opts.flag} flag allows outings`,
      met: Boolean(opts.flag) && !flagStopsOutings(opts.flag),
    });
    return reqs;
  }
  const seated = [BANK_RIDER, ...CREW_SEATS].filter((s) => view(s)?.member_id);
  const ok = seated.filter(available).length;
  return [
    {
      key: 'all',
      label: seated.length === 0 ? 'Someone seated' : `Everyone seated available (${ok}/${seated.length})`,
      met: seated.length > 0 && ok === seated.length,
    },
  ];
}

function bankRiderReason(flag: string | null, cox: string | null): string {
  const f = flagKey(flag);
  if (f === 'amber') return 'amber flag';
  return `${flag} flag, ${cox === 'Novice (less than 1 term)' ? 'novice cox (<1 term)' : 'novice cox'}`;
}

/**
 * "Swap in subs" (as the current drawer): rowers (Stroke→Bow; not the cox or bank rider) whose status
 * is Not Available are paired in seat order with seated subs whose status is Available (Sub 1→4).
 * Each pair is swapped member AND status, so the rower seat gets the sub as Available and the sub
 * seat gets the rower as Not Available. Each pair is one atomic seat/swap call with its own undo.
 */
export function subSwaps(view: (seat: string) => SeatView): { crew: string; sub: string }[] {
  const rowers = CREW_SEATS.filter((s) => s !== 'Cox' && view(s)?.member_id && view(s)?.status === 'Not Available');
  const subs = SUB_SEATS.filter((s) => view(s)?.member_id && view(s)?.status === 'Available');
  return rowers.slice(0, subs.length).map((crew, i) => ({ crew, sub: subs[i] }));
}

export const COX_EXPERIENCE = ['Novice (less than 1 term)', 'Novice', 'Experienced', 'Senior'] as const;

/**
 * May a cox of this experience go out under this flag? From the club's requirements text (below):
 *   green, grey: anyone · light blue: Experienced, Senior, Novice (not < 1 term) ·
 *   dark blue: Experienced, Senior · amber: Senior · red, black: no one.
 * Unknown flag or unknown experience: null (we can't say).
 */
export function coxEligible(flag: string | null | undefined, experience: string | null | undefined): boolean | null {
  const f = flagKey(flag);
  if (f === 'red' || f === 'black') return false;
  if (f === 'green' || f === 'grey') return true;
  if (!experience) return null;
  if (f === 'light-blue') return experience === 'Experienced' || experience === 'Senior' || experience === 'Novice';
  if (f === 'dark-blue') return experience === 'Experienced' || experience === 'Senior';
  if (f === 'amber') return experience === 'Senior';
  return null;
}

export const LIGHT_BLUE_REGISTER_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSe6Lkd2v323rhEmIKbHIBjJ8ew1aR2YaJY416xoleVR3y1pZg/viewform';

/** The river requirements shown on water outings, word for word from the current drawer. */
export function flagRequirements(flag: string | null | undefined): { text: string; registerUrl?: string } {
  switch (flagKey((flag ?? '').replace(/ flag$/i, ''))) {
    case 'green':
      return { text: 'Novice coxes must have a bankrider.' };
    case 'light-blue':
      return {
        text:
          "Only Experienced and Senior coxes may go out. Novice coxes with more than one term's experience may go out with senior crews in daylight hours only, and be accompanied by a bankrider with throw-line and lockkeeper number (01865 777 277), with crew and bankrider registered >2 hours before outing.",
        registerUrl: LIGHT_BLUE_REGISTER_URL,
      };
    case 'dark-blue':
      return { text: 'No Novice or unregistered coxes.' };
    case 'amber':
      return {
        text: 'Senior coxes may go out only with senior crews. All crews must be accompanied by a bankrider with throw-line and lockkeeper number (01865 777 277).',
      };
    case 'red':
    case 'black':
      return { text: 'No crews are allowed out.' };
    case 'grey':
      return { text: 'Flag not currently being maintained. Anyone is allowed to cox.' };
    default:
      return { text: 'Requirements not available.' };
  }
}
