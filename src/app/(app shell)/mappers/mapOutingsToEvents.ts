// src/app/(app shell)/mappers/mapOutingsToEvents.ts

import { Outing } from '@/types/outing';
import { CalendarEvent, EventType, EVENT_TYPE_COLORS, EVENT_STATUS_COLORS } from '@/types/calendar';

/**
 * Maps Notion outing data to calendar events
 * Filters out unpublished outings and handles date parsing
 */
export function mapOutingsToEvents(outings: Outing[]): CalendarEvent[] {
  console.log('🔄 Mapping outings to events:', outings.length, 'total outings');

  const publishedOutings = outings.filter(isPublishedOuting);
  console.log('📝 Published outings:', publishedOutings.length);

  const events = publishedOutings
    .map(mapOutingToEvent)
    .filter((event): event is CalendarEvent => event !== null);

  console.log('✅ Successfully mapped events:', events.length);

  return events;
}

/**
 * Maps a single outing to a calendar event
 */
function mapOutingToEvent(outing: Outing): CalendarEvent | null {
  try {
    // Extract start and end dates
    const startDateTime = outing.properties.StartDateTime?.date?.start;
    const endDateTime = outing.properties.EndDateTime?.date?.start;

    if (!startDateTime) {
      console.warn(`Outing ${outing.id} missing start date`);
      return null;
    }

    const startTime = new Date(startDateTime);
    const endTime = endDateTime ? new Date(endDateTime) : new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // Default 2 hours

    // Extract event properties
    const type = extractEventType(outing);
    const division = extractDivision(outing);
    const title = extractTitle(outing, type);
    const status = extractStatus(outing);
    const outingId = extractOutingId(outing);

    return {
      id: outing.id,
      title,
      startTime,
      endTime,
      type,
      division,
      shell: outing.properties.Shell?.select?.name,
      status,
      sessionDetails: extractSessionDetails(outing),
      outingId,
      color: getEventColor(type, status),
      isPublished: true, // Already filtered for published
      originalOuting: outing.id,
    };
  } catch (error) {
    console.error(`Error mapping outing ${outing.id}:`, error);
    return null;
  }
}

/**
 * Checks if an outing is published and should be displayed
 */
function isPublishedOuting(outing: Outing): boolean {
  return outing.properties.PublishOuting?.checkbox === true;
}

/**
 * Extracts event type from outing data
 */
function extractEventType(outing: Outing): EventType {
  const type = outing.properties.Type?.select?.name;

  switch (type) {
    case 'Erg Session':
      return 'Erg';
    case 'Water Outing':
      return 'Water';
    case 'Tank Session':
      return 'Tank';
    case 'Gym Session':
      return 'Gym';
    default:
      return 'Other';
  }
}

/**
 * Extracts division from outing data
 */
function extractDivision(outing: Outing): string {
  return outing.properties.Div?.select?.name || 'Unknown';
}

/**
 * Generates a display title for the event
 */
function extractTitle(outing: Outing, type: EventType): string {
  const outingId = extractOutingId(outing);
  const shell = outing.properties.Shell?.select?.name;

  // Format: "O1 Erg" or "O1 Water (VIII+)"
  let title = `O${outingId} ${type}`;

  if (shell && type === 'Water') {
    title += ` (${shell})`;
  }

  return title;
}

/**
 * Extracts outing status
 */
function extractStatus(outing: Outing): CalendarEvent['status'] {
  const status = outing.properties.OutingStatus?.status?.name;

  switch (status) {
    case 'Provisional':
      return 'Provisional Outing';
    case 'Confirmed':
      return 'Outing Confirmed';
    case 'Cancelled':
      return 'Outing Cancelled';
    default:
      return 'Provisional Outing';
  }
}

/**
 * Extracts outing ID number
 */
function extractOutingId(outing: Outing): number {
  return outing.properties.OutingID?.unique_id?.number || 0;
}

/**
 * Extracts session details
 */
function extractSessionDetails(outing: Outing): string | undefined {
  const richText = outing.properties.SessionDetails?.rich_text;
  if (Array.isArray(richText) && richText.length > 0) {
    return (richText as { plain_text?: string }[])
      .map(text => text.plain_text || '')
      .join('');
  }
  return undefined;
}

/**
 * Determines event color based on type and status
 */
function getEventColor(type: EventType, status: CalendarEvent['status']): string {
  // Use status color for cancelled events
  if (status === 'Outing Cancelled') {
    return EVENT_STATUS_COLORS[status];
  }

  // Use type color for confirmed and provisional events
  return EVENT_TYPE_COLORS[type];
}

/**
 * Filters events for a specific date range
 */
export function filterEventsByDateRange(
  events: CalendarEvent[],
  startDate: Date,
  endDate: Date
): CalendarEvent[] {
  return events.filter(event => {
    const eventDate = event.startTime;
    return eventDate >= startDate && eventDate <= endDate;
  });
}

/**
 * Groups events by date for calendar display
 * Uses local date to avoid timezone shifts
 */
export function groupEventsByDate(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  return events.reduce((groups, event) => {
    // Use local date instead of UTC to avoid timezone shifts
    const year = event.startTime.getFullYear();
    const month = String(event.startTime.getMonth() + 1).padStart(2, '0');
    const day = String(event.startTime.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(event);
    return groups;
  }, {} as Record<string, CalendarEvent[]>);
}

/**
 * Sorts events by start time
 */
export function sortEventsByTime(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

/**
 * Filters events by type
 */
export function filterEventsByType(
  events: CalendarEvent[],
  filterType: EventType | 'All'
): CalendarEvent[] {
  if (filterType === 'All') {
    return events;
  }
  return events.filter(event => event.type === filterType);
}

/**
 * Filters outings by member ID
 * Checks if the member appears in any seat property
 */
export function filterOutingsByMember(
  outings: Outing[],
  memberId?: string
): Outing[] {
  console.log('🔍 filterOutingsByMember: memberId:', memberId);
  console.log('🔍 filterOutingsByMember: total outings:', outings.length);

  if (!memberId) {
    console.log('🔍 filterOutingsByMember: No memberId, returning all outings');
    return outings;
  }

  const filtered = outings.filter((outing, index) => {
    const seatProperties = [
      'Cox',
      'Stroke',
      'Bow',
      '2 Seat',
      '3 Seat',
      '4 Seat',
      '5 Seat',
      '6 Seat',
      '7 Seat',
      'CoachBankRider',
      'Sub1',
      'Sub2',
      'Sub3',
      'Sub4',
    ];

    // Log first outing's structure for debugging
    if (index === 0) {
      console.log('🔍 Sample outing properties:', Object.keys(outing.properties));
      console.log('🔍 Looking for memberId:', memberId);
      seatProperties.forEach(seatProp => {
        const relationProp = outing.properties[seatProp as keyof typeof outing.properties];
        console.log(`🔍 Checking ${seatProp}:`, relationProp);
        console.log(`🔍 ${seatProp} type:`, typeof relationProp);
        console.log(`🔍 ${seatProp} is array:`, Array.isArray(relationProp));
        if (relationProp && 'relation' in relationProp) {
          console.log(`🔍 ${seatProp} has relation property with length:`, relationProp.relation.length);
          if (relationProp.relation.length > 0) {
            console.log(`🔍 ${seatProp} relation IDs:`, relationProp.relation.map(r => r.id));
          }
        } else if (Array.isArray(relationProp) && relationProp.length > 0) {
          console.log(`🔍 ${seatProp} is ARRAY with IDs:`, relationProp.map((r: any) => r.id));
        } else {
          console.log(`🔍 ${seatProp} structure unknown`);
        }
      });
    }

    // Check if memberId appears in any seat relation
    const hasMatch = seatProperties.some(seatProp => {
      const relationProp = outing.properties[seatProp as keyof typeof outing.properties];

      // Handle direct array structure (e.g., [{id: '...'}, ...])
      if (Array.isArray(relationProp)) {
        const matches = relationProp.some((rel: any) => {
          const relId = rel.id;
          const isMatch = relId === memberId;
          if (isMatch) {
            console.log(`✅ Match found in ${seatProp}: ${relId} === ${memberId}`);
          }
          return isMatch;
        });
        return matches;
      }

      // Handle object with relation property (fallback for different data structure)
      if (relationProp && typeof relationProp === 'object' && 'relation' in relationProp) {
        const matches = relationProp.relation.some((rel: any) => {
          const relId = rel.id;
          const isMatch = relId === memberId;
          if (isMatch) {
            console.log(`✅ Match found in ${seatProp}: ${relId} === ${memberId}`);
          }
          return isMatch;
        });
        return matches;
      }

      return false;
    });

    if (hasMatch) {
      console.log(`✅ Outing ${outing.id} includes member ${memberId}`);
    }

    return hasMatch;
  });

  console.log('🔍 filterOutingsByMember: filtered outings:', filtered.length);
  return filtered;
}
