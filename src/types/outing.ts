// src/types/outing.ts

export interface SelectProperty {
  select?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

export interface RelationProperty {
  relation: { id: string }[];
  has_more: boolean;
}

export interface StatusProperty {
  status?: {
    id: string;
    name: 'Available' | 'Maybe Available' | 'Awaiting Approval' | 'Not Available' | 'Provisional' | 'Confirmed' | 'Cancelled';
    color: string;
  } | null;
}

export interface DateProperty {
  date: {
    start: string;
    end: string | null;
  } | null;
}

export interface CheckboxProperty {
  checkbox: boolean;
}

export interface UniqueIdProperty {
  unique_id: {
    prefix: string | null;
    number: number;
  };
}

export interface RichTextProperty {
  rich_text: unknown[]; // Optional: you can strongly type this later if needed
}

export interface TitleProperty {
  title: {
    plain_text: string;
  }[];
}

export interface Outing {
  id: string;
  properties: {
    Term?: SelectProperty;
    Week?: SelectProperty;
    Div?: SelectProperty;
    Type?: SelectProperty;
    Shell?: SelectProperty;
    OutingStatus?: StatusProperty;
    PublishOuting?: CheckboxProperty;
    OutingID?: UniqueIdProperty;
    StartDateTime?: DateProperty;
    EndDateTime?: DateProperty;
    SessionDetails?: RichTextProperty;
    Name?: TitleProperty;

    Cox?: RelationProperty;
    CoxStatus?: StatusProperty;
    Stroke?: RelationProperty;
    StrokeStatus?: StatusProperty;
    Bow?: RelationProperty;
    BowStatus?: StatusProperty;
    CoachBankRider?: RelationProperty;
    BankRiderStatus?: StatusProperty;

    '2 Seat'?: RelationProperty;
    '2 Seat Status'?: StatusProperty;
    '3 Seat'?: RelationProperty;
    '3 Seat Status'?: StatusProperty;
    '4 Seat'?: RelationProperty;
    '4 Seat Status'?: StatusProperty;
    '5 Seat'?: RelationProperty;
    '5 Seat Status'?: StatusProperty;
    '6 Seat'?: RelationProperty;
    '6 Seat Status'?: StatusProperty;
    '7 Seat'?: RelationProperty;
    '7 Seat Status'?: StatusProperty;

    Sub1?: RelationProperty;
    Sub1Status?: StatusProperty;
    Sub2?: RelationProperty;
    Sub2Status?: StatusProperty;
    Sub3?: RelationProperty;
    Sub3Status?: StatusProperty;
    Sub4?: RelationProperty;
    Sub4Status?: StatusProperty;
  };
}

// Raw outing data from Notion API (includes timestamps)
export interface RawOuting extends Outing {
  created_time: string;
  last_edited_time: string;
}

export interface Member {
  id: string;
  name: string;
  role?: string;
}

// Enhanced types for detailed outing view
export enum SeatType {
  Cox = 'Cox',
  Stroke = 'Stroke',
  Bow = 'Bow',
  Seat2 = '2 Seat',
  Seat3 = '3 Seat',
  Seat4 = '4 Seat',
  Seat5 = '5 Seat',
  Seat6 = '6 Seat',
  Seat7 = '7 Seat',
  CoachBankRider = 'Coach/Bank Rider',
  Sub1 = 'Sub 1',
  Sub2 = 'Sub 2',
  Sub3 = 'Sub 3',
  Sub4 = 'Sub 4'
}

export enum AvailabilityStatus {
  Available = 'Available',
  MaybeAvailable = 'Maybe Available',
  AwaitingApproval = 'Awaiting Approval',
  NotAvailable = 'Not Available',
  // These are also used for outing-level status
  Provisional = 'Provisional',
  Confirmed = 'Confirmed',
  Cancelled = 'Cancelled'
}

export enum OutingStatus {
  Provisional = 'Provisional',
  Confirmed = 'Confirmed',
  Cancelled = 'Cancelled'
}

export interface SeatAssignment {
  seatType: SeatType;
  member: Member | null;
  availabilityStatus: AvailabilityStatus | null;
  isAvailable: boolean;
}

export interface DetailedOuting extends Outing {
  created_time: string;
  last_edited_time: string;
  seatAssignments: SeatAssignment[];
  sessionDetailsText: string;
  availableSeats: SeatType[];
}