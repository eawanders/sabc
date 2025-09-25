// src/types/test.ts

import { Member } from './members';

export type TestType = 'Capsize Drill' | 'Swim Test';
export type TestOutcome = 'No Show' | 'Test Booked' | 'Failed' | 'Passed';

export interface TestSlot {
  member?: Member;
  outcome?: TestOutcome;
}

export interface Test {
  id: string;
  url: string;
  title: string; // "OURC Test" field from Notion
  type: TestType;
  availableSlots: number;
  date: {
    start: string;
    end?: string;
    isDatetime: boolean;
  };
  // Individual slots with member assignments and outcomes
  slot1?: Member[];
  slot2?: Member[];
  slot3?: Member[];
  slot4?: Member[];
  slot5?: Member[];
  slot6?: Member[];
  slot1Outcome?: TestOutcome;
  slot2Outcome?: TestOutcome;
  slot3Outcome?: TestOutcome;
  slot4Outcome?: TestOutcome;
  slot5Outcome?: TestOutcome;
  slot6Outcome?: TestOutcome;
}

// Extended calendar event for tests
export interface TestCalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  type: TestType;
  availableSlots: number;
  bookedSlots: number;
  status: 'Available' | 'Full' | 'Cancelled';

  // Color and display properties
  color: string;
  isPublished: boolean;

  // Original test reference for detailed view
  originalTest: string; // test.id for reference
}

// Notion API property interfaces for tests
export interface TestTitleProperty {
  title: {
    plain_text: string;
  }[];
}

export interface TestSelectProperty {
  select?: {
    id: string;
    name: TestType;
    color: string;
  } | null;
}

export interface TestNumberProperty {
  number: number | null;
}

export interface TestDateProperty {
  date: {
    start: string;
    end: string | null;
  } | null;
}

export interface TestRelationProperty {
  relation: { id: string }[];
  has_more: boolean;
}

export interface TestStatusProperty {
  status?: {
    id: string;
    name: TestOutcome;
    color: string;
  } | null;
}

// Complete test page response from Notion
export interface TestPageResponse {
  id: string;
  url: string;
  properties: {
    'OURC Test': TestTitleProperty;
    'Type': TestSelectProperty;
    'Available Slots': TestNumberProperty;
    'Date': TestDateProperty;
    'Slot 1': TestRelationProperty;
    'Slot 2': TestRelationProperty;
    'Slot 3': TestRelationProperty;
    'Slot 4': TestRelationProperty;
    'Slot 5': TestRelationProperty;
    'Slot 6': TestRelationProperty;
    'Slot 1 Outcome': TestStatusProperty;
    'Slot 2 Outcome': TestStatusProperty;
    'Slot 3 Outcome': TestStatusProperty;
    'Slot 4 Outcome': TestStatusProperty;
    'Slot 5 Outcome': TestStatusProperty;
    'Slot 6 Outcome': TestStatusProperty;
  };
}

// Test filter type for UI
export type TestFilterType = 'All' | 'Swim test' | 'Capsize Drill';