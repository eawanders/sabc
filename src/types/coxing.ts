// src/types/coxing.ts

export interface CoxingAvailability {
  id: string; // Notion page ID for the date row
  date: string; // ISO date string
  earlyAM: string[]; // Array of member IDs available for Early AM
  midAM: string[]; // Array of member IDs available for Mid AM
  midPM: string[]; // Array of member IDs available for Mid PM
  latePM: string[]; // Array of member IDs available for Late PM
}

export interface CoxingUpdateRequest {
  memberId: string;
  date: string; // ISO date string
  timeSlot: 'earlyAM' | 'midAM' | 'midPM' | 'latePM';
  action: 'add' | 'remove'; // Whether to add or remove the member from availability
}

export interface CoxingUpdateResponse {
  success: boolean;
  message: string;
  availability?: CoxingAvailability;
}