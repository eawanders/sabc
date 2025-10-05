import { z } from 'zod';

// Common schemas
export const notionPageIdSchema = z.string().regex(/^[a-f0-9]{32}$/, 'Invalid Notion page ID format');
export const emailSchema = z.string().email().max(255);
export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const timeStringSchema = z.string().regex(/^\d{2}:\d{2}$/);

// Member schemas
export const addMemberSchema = z.object({
  name: z.string().min(1).max(120),
  email: emailSchema.optional(),
  role: z.enum(['admin', 'coach', 'member']).default('member'),
  college: z.string().max(100).optional(),
}).strict();

export const updateMemberSchema = z.object({
  memberId: notionPageIdSchema,
  name: z.string().min(1).max(120).optional(),
  email: emailSchema.optional(),
  role: z.enum(['admin', 'coach', 'member']).optional(),
  college: z.string().max(100).optional(),
}).strict();

// Outing schemas
export const assignSeatSchema = z.object({
  outingId: notionPageIdSchema,
  seat: z.string().min(1).max(10), // e.g., "Stroke", "7", "6", etc.
  memberId: notionPageIdSchema,
}).strict();

export const updateSeatSchema = z.object({
  outingId: notionPageIdSchema,
  seat: z.string().min(1).max(10),
  memberId: notionPageIdSchema.nullable(),
}).strict();

export const submitOutingReportSchema = z.object({
  outingId: notionPageIdSchema,
  report: z.string().min(10).max(5000),
  distance: z.number().min(0).max(100).optional(),
  duration: z.number().min(0).max(600).optional(), // max 10 hours in minutes
  conditions: z.string().max(500).optional(),
}).strict();

export const updateOutingStatusSchema = z.object({
  outingId: notionPageIdSchema,
  status: z.enum(['Scheduled', 'In Progress', 'Completed', 'Cancelled']),
}).strict();

// Availability schemas
export const confirmAvailabilitySchema = z.object({
  outingId: notionPageIdSchema,
  memberId: notionPageIdSchema,
  available: z.boolean(),
  comment: z.string().max(500).optional(),
}).strict();

export const updateAvailabilitySchema = z.object({
  outingId: notionPageIdSchema,
  memberId: notionPageIdSchema,
  status: z.enum(['Available', 'Unavailable', 'Maybe']),
}).strict();

export const updateCoxingAvailabilitySchema = z.object({
  date: dateStringSchema,
  memberId: notionPageIdSchema,
  morning: z.boolean(),
  afternoon: z.boolean(),
  evening: z.boolean(),
}).strict();

// Test schemas
export const assignTestSlotSchema = z.object({
  testId: notionPageIdSchema,
  memberId: notionPageIdSchema,
  slot: z.string().min(1).max(50),
  date: dateStringSchema,
  time: timeStringSchema,
}).strict();

export const updateTestOutcomeSchema = z.object({
  testId: notionPageIdSchema,
  memberId: notionPageIdSchema,
  outcome: z.enum(['Pass', 'Fail', 'Pending']),
  score: z.number().min(0).max(100).optional(),
  notes: z.string().max(1000).optional(),
}).strict();

// Query parameter schemas
export const getOutingsQuerySchema = z.object({
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  status: z.enum(['Scheduled', 'In Progress', 'Completed', 'Cancelled']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
}).strict();

export const getTestsQuerySchema = z.object({
  type: z.string().max(50).optional(),
  status: z.enum(['Upcoming', 'Completed', 'Cancelled']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
}).strict();

export const getMembersQuerySchema = z.object({
  role: z.enum(['admin', 'coach', 'member']).optional(),
  search: z.string().max(100).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
}).strict();

// Flag status schema
export const flagStatusSchema = z.object({
  status: z.enum(['green', 'amber', 'red', 'blue', 'grey']),
  reason: z.string().max(500).optional(),
  updatedBy: notionPageIdSchema,
}).strict();

// Export types
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type AssignSeatInput = z.infer<typeof assignSeatSchema>;
export type UpdateSeatInput = z.infer<typeof updateSeatSchema>;
export type SubmitOutingReportInput = z.infer<typeof submitOutingReportSchema>;
export type UpdateOutingStatusInput = z.infer<typeof updateOutingStatusSchema>;
export type ConfirmAvailabilityInput = z.infer<typeof confirmAvailabilitySchema>;
export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;
export type UpdateCoxingAvailabilityInput = z.infer<typeof updateCoxingAvailabilitySchema>;
export type AssignTestSlotInput = z.infer<typeof assignTestSlotSchema>;
export type UpdateTestOutcomeInput = z.infer<typeof updateTestOutcomeSchema>;
export type GetOutingsQuery = z.infer<typeof getOutingsQuerySchema>;
export type GetTestsQuery = z.infer<typeof getTestsQuerySchema>;
export type GetMembersQuery = z.infer<typeof getMembersQuerySchema>;
export type FlagStatusInput = z.infer<typeof flagStatusSchema>;
