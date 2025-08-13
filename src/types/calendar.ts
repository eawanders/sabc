// src/types/calendar.ts

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  type: 'Erg' | 'Water' | 'Tank' | 'Gym' | 'Other';
  division: string;
  shell?: string;
  status: 'Provisional Outing' | 'Outing Confirmed' | 'Outing Cancelled';
  sessionDetails?: string;
  outingId: number;

  // Color and display properties
  color: string;
  isPublished: boolean;

  // Original outing reference for detailed view
  originalOuting: string; // outing.id for reference
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface WeekRange extends DateRange {
  weekLabel: string; // e.g., "02 - 08 March"
  year: number;
  weekNumber: number;
}

export interface CalendarDay {
  date: Date;
  dayName: string; // Mon, Tue, Wed, etc.
  dayNumber: number; // 02, 03, 04, etc.
  monthName: string; // March, April, etc.
  isToday: boolean;
  events: CalendarEvent[];
}

export interface CalendarViewState {
  currentWeek: WeekRange;
  selectedDate?: Date;
  selectedEvent?: CalendarEvent;
  isLoading: boolean;
  error?: string;
}

// Type guards for event filtering
export type EventType = CalendarEvent['type'];
export type EventStatus = CalendarEvent['status'];

// Color mapping for different event types
export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  'Erg': '#3B82F6', // Blue
  'Water': '#10B981', // Green
    'Tank': '#F59E0B', // Amber
    'Gym': '#F472B6', // Pink
  'Other': '#6B7280', // Gray
};

// Status colors
export const EVENT_STATUS_COLORS: Record<EventStatus, string> = {
  'Provisional Outing': '#F59E0B', // Amber
  'Outing Confirmed': '#10B981', // Green
  'Outing Cancelled': '#EF4444', // Red
};
