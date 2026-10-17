// src/lib/notion/outings.ts
import { Outing, RawOuting, DetailedOuting, SeatType, AvailabilityStatus, SeatAssignment, Member } from '@/types/outing';

/**
 * Fetch a single outing by ID with basic data
 */
export async function getOutingById(id: string): Promise<RawOuting | null> {
  try {
    console.log('🔍 getOutingById: Fetching outing with ID:', id);

    // Use relative URL to work in all environments (localhost, staging, production)
    const response = await fetch(`/api/get-outing/${id}`);

    console.log('🔍 getOutingById: Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to fetch outing ${id}:`, response.status, response.statusText, errorText);
      return null;
    }

    const data = await response.json();
    console.log('✅ getOutingById: Successfully received data:', data);

    return data.outing as RawOuting;
  } catch (error) {
    console.error('❌ getOutingById: Error fetching outing by ID:', error);
    return null;
  }
}

/**
 * Get member details from Notion Members database.
 * Throws if the members can't be fetched: an empty result would make every occupied seat look free.
 */
export async function getMembersByIds(memberIds: string[]): Promise<Member[]> {
  if (memberIds.length === 0) return [];

  const params = new URLSearchParams({ ids: memberIds.join(',') });

  // Fetch only the members we need - use relative URL to work in all environments
  const response = await fetch(`/api/get-members?${params.toString()}`);

  if (!response.ok) {
    console.error('Failed to fetch members:', response.status);
    throw new Error(`Failed to fetch members: ${response.status}`);
  }

  const data = await response.json();
  const allMembers = data.members as Array<{id: string; name: string; email: string; memberType: string}>;

  // Convert to our Member type and filter to only requested IDs
  return allMembers.map(member => ({
    id: member.id,
    name: member.name,
    role: member.memberType
  }));
}

// Shown for a seat whose relation points at a member we couldn't resolve
export const UNKNOWN_MEMBER_NAME = 'Unknown member';

/**
 * Convert raw outing data to detailed outing with populated member data
 */
export async function getOutingWithMembers(id: string): Promise<DetailedOuting | null> {
  try {
    console.log(`📖 [getOutingWithMembers] Fetching outing with ID: ${id}`);

    // Fetch the basic outing data
    const outing = await getOutingById(id);
    if (!outing) {
      console.warn(`⚠️ [getOutingWithMembers] No outing found for ID: ${id}`);
      return null;
    }

    console.log(`✅ [getOutingWithMembers] Outing found, checking seat fields...`);

    // Extract all member IDs from relations
    const memberIds = new Set<string>();
    const seatFields: (keyof typeof outing.properties)[] = [
      'Cox', 'Stroke', 'Bow', '2 Seat', '3 Seat', '4 Seat',
      '5 Seat', '6 Seat', '7 Seat', 'CoachBankRider',
      'Sub1', 'Sub2', 'Sub3', 'Sub4'
    ];

    console.log(`🔍 [getOutingWithMembers] Checking seat fields for member relations...`);

    seatFields.forEach(field => {
      const relation = outing.properties[field] as { relation: { id: string }[] } | undefined;
      if (relation?.relation) {
        console.log(`📍 [getOutingWithMembers] Field "${field}" has ${relation.relation.length} member(s):`, relation.relation.map(r => r.id));
        relation.relation.forEach(rel => memberIds.add(rel.id));
      } else {
        const isSub = field.startsWith('Sub');
        if (isSub) {
          console.log(`⚠️ [getOutingWithMembers] SUB field "${field}" has no relation data. Full property:`, outing.properties[field]);
        }
      }
    });

    // Fetch member details
    const members = await getMembersByIds(Array.from(memberIds));
    const memberMap = new Map(members.map(m => [m.id, m]));

    // Create seat assignments
    const seatAssignments: SeatAssignment[] = [];

    const seatMappings: { seatType: SeatType; relationField: keyof typeof outing.properties; statusField: keyof typeof outing.properties }[] = [
      { seatType: SeatType.Cox, relationField: 'Cox', statusField: 'CoxStatus' },
      { seatType: SeatType.Stroke, relationField: 'Stroke', statusField: 'StrokeStatus' },
      { seatType: SeatType.Bow, relationField: 'Bow', statusField: 'BowStatus' },
      { seatType: SeatType.Seat2, relationField: '2 Seat', statusField: '2 Seat Status' },
      { seatType: SeatType.Seat3, relationField: '3 Seat', statusField: '3 Seat Status' },
      { seatType: SeatType.Seat4, relationField: '4 Seat', statusField: '4 Seat Status' },
      { seatType: SeatType.Seat5, relationField: '5 Seat', statusField: '5 Seat Status' },
      { seatType: SeatType.Seat6, relationField: '6 Seat', statusField: '6 Seat Status' },
      { seatType: SeatType.Seat7, relationField: '7 Seat', statusField: '7 Seat Status' },
      { seatType: SeatType.CoachBankRider, relationField: 'CoachBankRider', statusField: 'BankRiderStatus' },
      { seatType: SeatType.Sub1, relationField: 'Sub1', statusField: 'Sub1Status' },
      { seatType: SeatType.Sub2, relationField: 'Sub2', statusField: 'Sub2Status' },
      { seatType: SeatType.Sub3, relationField: 'Sub3', statusField: 'Sub3Status' },
      { seatType: SeatType.Sub4, relationField: 'Sub4', statusField: 'Sub4Status' },
    ];

    seatMappings.forEach(({ seatType, relationField, statusField }) => {
      const relation = outing.properties[relationField] as { relation: { id: string }[] } | undefined;
      const status = outing.properties[statusField] as { status: { name: string } | null } | undefined;

      const memberId = relation?.relation?.[0]?.id;
      // A relation we can't resolve is still an occupied seat
      const member = memberId ? memberMap.get(memberId) || { id: memberId, name: UNKNOWN_MEMBER_NAME } : null;
      const availabilityStatus = status?.status?.name as AvailabilityStatus || AvailabilityStatus.AwaitingApproval;

      // A seat is available for assignment if:
      // 1. No member is assigned AND status is "Awaiting Approval"
      // (If someone is assigned, the seat is taken regardless of status)
      const isAvailable = !memberId && availabilityStatus === AvailabilityStatus.AwaitingApproval;

      seatAssignments.push({
        seatType,
        member,
        availabilityStatus,
        isAvailable
      });
    });

    // Extract session details text
    const sessionDetails = outing.properties.SessionDetails as { rich_text: unknown[]; plain_text?: string } | undefined;
    const sessionDetailsText = sessionDetails?.plain_text || '';

    // Determine available seats
    const availableSeats = seatAssignments
      .filter(assignment => assignment.isAvailable)
      .map(assignment => assignment.seatType);

    const detailedOuting: DetailedOuting = {
      ...outing,
      created_time: outing.created_time || new Date().toISOString(),
      last_edited_time: outing.last_edited_time || new Date().toISOString(),
      seatAssignments,
      sessionDetailsText,
      availableSeats
    };

    return detailedOuting;
  } catch (error) {
    // Rethrow so the caller shows an error rather than seats with their members missing
    console.error('Error creating detailed outing:', error);
    throw error;
  }
}

/**
 * Get available seats for an outing
 */
export function getAvailableSeats(outing: Outing): SeatType[] {
  const availableSeats: SeatType[] = [];

  const seatMappings: { seatType: SeatType; relationField: keyof typeof outing.properties; statusField: keyof typeof outing.properties }[] = [
    { seatType: SeatType.Cox, relationField: 'Cox', statusField: 'CoxStatus' },
    { seatType: SeatType.Stroke, relationField: 'Stroke', statusField: 'StrokeStatus' },
    { seatType: SeatType.Bow, relationField: 'Bow', statusField: 'BowStatus' },
    { seatType: SeatType.Seat2, relationField: '2 Seat', statusField: '2 Seat Status' },
    { seatType: SeatType.Seat3, relationField: '3 Seat', statusField: '3 Seat Status' },
    { seatType: SeatType.Seat4, relationField: '4 Seat', statusField: '4 Seat Status' },
    { seatType: SeatType.Seat5, relationField: '5 Seat', statusField: '5 Seat Status' },
    { seatType: SeatType.Seat6, relationField: '6 Seat', statusField: '6 Seat Status' },
    { seatType: SeatType.Seat7, relationField: '7 Seat', statusField: '7 Seat Status' },
    { seatType: SeatType.CoachBankRider, relationField: 'CoachBankRider', statusField: 'BankRiderStatus' },
    { seatType: SeatType.Sub1, relationField: 'Sub1', statusField: 'Sub1Status' },
    { seatType: SeatType.Sub2, relationField: 'Sub2', statusField: 'Sub2Status' },
    { seatType: SeatType.Sub3, relationField: 'Sub3', statusField: 'Sub3Status' },
    { seatType: SeatType.Sub4, relationField: 'Sub4', statusField: 'Sub4Status' },
  ];

  seatMappings.forEach(({ seatType, relationField, statusField }) => {
    const relation = outing.properties[relationField] as { relation: { id: string }[] } | undefined;
    const status = outing.properties[statusField] as { status: { name: string } | null } | undefined;

    const hasAssignment = relation?.relation && relation.relation.length > 0;
    const availabilityStatus = status?.status?.name as AvailabilityStatus || AvailabilityStatus.AwaitingApproval;

    // A seat is available for assignment if:
    // 1. No member is assigned AND status is "Awaiting Approval"
    const isAvailable = !hasAssignment && availabilityStatus === AvailabilityStatus.AwaitingApproval;

    if (isAvailable) {
      availableSeats.push(seatType);
    }
  });

  return availableSeats;
}

/**
 * Map seat type to API field names for updates
 */
export function getSeatFieldNames(seatType: SeatType): { relationField: string; statusField: string } {
  const mapping: Record<SeatType, { relationField: string; statusField: string }> = {
    [SeatType.Cox]: { relationField: 'Cox', statusField: 'Cox Status' },
    [SeatType.Stroke]: { relationField: 'Stroke', statusField: 'Stroke Status' },
    [SeatType.Bow]: { relationField: 'Bow', statusField: 'Bow Status' },
    [SeatType.Seat2]: { relationField: '2 Seat', statusField: '2 Seat Status' },
    [SeatType.Seat3]: { relationField: '3 Seat', statusField: '3 Seat Status' },
    [SeatType.Seat4]: { relationField: '4 Seat', statusField: '4 Seat Status' },
    [SeatType.Seat5]: { relationField: '5 Seat', statusField: '5 Seat Status' },
    [SeatType.Seat6]: { relationField: '6 Seat', statusField: '6 Seat Status' },
    [SeatType.Seat7]: { relationField: '7 Seat', statusField: '7 Seat Status' },
    [SeatType.CoachBankRider]: { relationField: 'Coach/Bank Rider', statusField: 'Bank Rider Status' },
    [SeatType.Sub1]: { relationField: 'Sub 1', statusField: 'Sub 1 Status' },
    [SeatType.Sub2]: { relationField: 'Sub 2', statusField: 'Sub 2 Status' },
    [SeatType.Sub3]: { relationField: 'Sub 3', statusField: 'Sub 3 Status' },
    [SeatType.Sub4]: { relationField: 'Sub 4', statusField: 'Sub 4 Status' },
  };

  return mapping[seatType];
}
