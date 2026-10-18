// Share and add-to-calendar for one outing.
import { buildGoogleCalendarLink } from '@/utils/calendarLinks';

export const CLUB_LOCATION = "St Anne's College Boat Club";

/** A link to this outing in the beta schedule: its week, and the drawer open. */
export function outingLink(origin: string, outingId: string, mondayIso: string): string {
  return `${origin}/beta/schedule?week=${mondayIso}&outing=${outingId}`;
}

/** End for calendars: the outing's end, or start + 1 h when missing or not after the start (as today). */
function calendarEnd(start: Date, end: Date | null): Date {
  return end && end > start ? end : new Date(start.getTime() + 60 * 60 * 1000);
}

export function googleCalendarUrl(o: { title: string; details?: string | null; start: Date; end: Date | null }): string {
  return buildGoogleCalendarLink({
    title: `SABC: ${o.title}`,
    description: o.details ?? undefined,
    start: o.start,
    end: calendarEnd(o.start, o.end),
    location: CLUB_LOCATION,
  });
}

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`);

export function icsFile(o: { id: string; title: string; details?: string | null; start: Date; end: Date | null }, now = new Date()): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SABC//Schedule//EN',
    'BEGIN:VEVENT',
    `UID:${o.id}@sabcoxford.com`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(o.start)}`,
    `DTEND:${icsDate(calendarEnd(o.start, o.end))}`,
    `SUMMARY:${icsText(`SABC: ${o.title}`)}`,
    ...(o.details ? [`DESCRIPTION:${icsText(o.details)}`] : []),
    `LOCATION:${icsText(CLUB_LOCATION)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

/** "O1 Water Outing", falling back as the current drawer does. */
export function outingTitle(o: { name?: string | null; div?: string | null; type?: string | null }): string {
  if (o.div && o.type) return `${o.div} ${o.type}`;
  if (o.div) return `${o.div} Outing`;
  if (o.type) return `${o.type} Outing`;
  return o.name || 'Unnamed Outing';
}
