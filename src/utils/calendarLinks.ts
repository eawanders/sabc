// src/utils/calendarLinks.ts

/**
 * Utilities for generating calendar integration links.
 */

interface GoogleCalendarLinkOptions {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
}

const GOOGLE_CALENDAR_RENDER_URL = 'https://calendar.google.com/calendar/render';

/**
 * Formats a Date into the YYYYMMDDTHHmmssZ format required by Google Calendar URLs.
 */
function formatDateForGoogleCalendar(date: Date): string {
  // Google Calendar expects UTC timestamps without separators or milliseconds.
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Builds a Google Calendar link that pre-populates event metadata.
 */
export function buildGoogleCalendarLink({
  title,
  description,
  start,
  end,
  location,
}: GoogleCalendarLinkOptions): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${formatDateForGoogleCalendar(start)}/${formatDateForGoogleCalendar(end)}`,
  });

  if (description) {
    params.set('details', description);
  }

  if (location) {
    params.set('location', location);
  }

  return `${GOOGLE_CALENDAR_RENDER_URL}?${params.toString()}`;
}

/**
 * Simplify retrieving plain text from a Notion rich_text array.
 */
export function extractPlainTextFromRichText(richText: unknown): string | undefined {
  if (!Array.isArray(richText)) return undefined;

  const text = richText
    .map((item) => (typeof item === 'object' && item && 'plain_text' in item ? String((item as { plain_text?: string }).plain_text ?? '') : ''))
    .join('')
    .trim();

  return text.length > 0 ? text : undefined;
}

interface ICalendarOptions {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
}

/**
 * Formats a Date into the YYYYMMDDTHHmmssZ format required by iCalendar files.
 */
function formatDateForICalendar(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Escapes special characters in iCalendar text fields.
 */
function escapeICalendarText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Builds an iCalendar (.ics) file content that can be downloaded and opened in calendar apps.
 * This is especially useful for mobile devices where it will prompt to open in the native calendar app.
 */
export function buildICalendarFile({
  title,
  description,
  start,
  end,
  location,
}: ICalendarOptions): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SABC//Rowing Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `DTSTART:${formatDateForICalendar(start)}`,
    `DTEND:${formatDateForICalendar(end)}`,
    `DTSTAMP:${formatDateForICalendar(new Date())}`,
    `UID:${start.getTime()}-${Math.random().toString(36).substring(7)}@sabc.app`,
    `SUMMARY:${escapeICalendarText(title)}`,
  ];

  if (description) {
    lines.push(`DESCRIPTION:${escapeICalendarText(description)}`);
  }

  if (location) {
    lines.push(`LOCATION:${escapeICalendarText(location)}`);
  }

  lines.push(
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR'
  );

  return lines.join('\r\n');
}

/**
 * Downloads an iCalendar file to the user's device.
 * On mobile, this will typically prompt to open in the default calendar app.
 */
export function downloadICalendarFile(icsContent: string, filename: string = 'event.ics'): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
