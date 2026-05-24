// src/types/marshal.ts

import type { Member } from './members';

export type MarshalRole = 'Marshal' | 'Umpire' | 'Static Umpire';

export type MarshalShift =
  | 'S1'
  | 'S2'
  | 'S3'
  | 'S4'
  | 'S5'
  | 'U1'
  | 'U2'
  | 'U3'
  | 'U4'
  | 'Static A'
  | 'Static B'
  | 'Static C';

export type MarshalDay = 'Wed' | 'Thu' | 'Fri' | 'Sat';

export type MarshalLocation =
  | 'Longbridges'
  | 'Top Gut'
  | 'Green 1 - Bottom Bunglines';

export type MarshalEvent = 'Eights 2026' | 'Torpids 2026' | 'Other';

export type ClashCrew = 'M4' | 'M3' | 'W3';

export type MarshalPersonStatus =
  | 'Open'
  | 'Reserved'
  | 'Maybe Available'
  | 'Awaiting Approval'
  | 'Confirmed'
  | 'Not Available';

export interface MarshalSlot {
  id: string;
  url: string;
  name: string;
  slotId?: number;
  event?: MarshalEvent;
  day?: MarshalDay;
  role?: MarshalRole;
  shift?: MarshalShift;
  location?: MarshalLocation;
  startTime: string;
  endTime?: string;
  isDatetime: boolean;
  person?: Member;
  personStatus: MarshalPersonStatus;
  clashCrews: ClashCrew[];
  notes?: string;
  publish: boolean;
}
