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
    name: 'Available' | 'Maybe Available' | 'Awaiting Approval' | 'Not Available' | 'Provisional Outing' | 'Outing Confirmed' | 'Outing Cancelled';
    color: string;
  };
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

export interface Member {
  id: string;
  name: string;
  role?: string;
}