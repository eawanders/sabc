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

