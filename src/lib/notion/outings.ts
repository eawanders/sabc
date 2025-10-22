// src/lib/notion/outings.ts
import { Outing, RawOuting, DetailedOuting, SeatType, AvailabilityStatus, SeatAssignment, Member } from '@/types/outing';

/**
 * Fetch a single outing by ID with basic data
 */
export async function getOutingById(id: string): Promise<RawOuting | null> {
  try {

    // Use relative URL to work in all environments (localhost, staging, production)
    const response = await fetch(`/api/get-outing/${id}`);


    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to fetch outing ${id}:`, response.status, response.statusText, errorText);
      return null;
    }

    const data = await response.json();

    return data.outing as RawOuting;
  } catch (error) {
    console.error('❌ getOutingById: Error fetching outing by ID:', error);
    return null;
  }
}

/**
 * Get member details from Notion Members database
 */
export async function getMembersByIds(memberIds: string[]): Promise<Member[]> {
  try {
    if (memberIds.length === 0) return [];

    const params = new URLSearchParams({ ids: memberIds.join(',') });

    // Fetch only the members we need - use relative URL to work in all environments
    const response = await fetch(`/api/get-members?${params.toString()}`);

    if (!response.ok) {
      console.error('Failed to fetch members:', response.status);
      return [];
    }

    const data = await response.json();
    const allMembers = data.members as Array<{id: string; name: string; email: string; memberType: string}>;

    // Convert to our Member type and filter to only requested IDs
    return allMembers.map(member => ({
      id: member.id,
      name: member.name,
      role: member.memberType
    }));
  } catch (error) {
    console.error('Error fetching members:', error);
    return [];
  }
}

/**
 * Convert raw outing data to detailed outing with populated member data
 */
export async function getOutingWithMembers(id: string): Promise<DetailedOuting | null> {
  try {

    // Fetch the basic outing data
    const outing = await getOutingById(id);
    if (!outing) {
      return null;
    }


    // Extract all member IDs from relations
    const memberIds = new Set<string>();
    const seatFields: (keyof typeof outing.properties)[] = [
      'Cox', 'Stroke', 'Bow', '2 Seat', '3 Seat', '4 Seat',
      '5 Seat', '6 Seat', '7 Seat', 'CoachBankRider',
      'Sub1', 'Sub2', 'Sub3', 'Sub4'
    ];


    seatFields.forEach(field => {
      const relation = outing.properties[field] as { relation: { id: string }[] } | undefined;
      if (relation?.relation) {
        relation.relation.forEach(rel => memberIds.add(rel.id));
      } else {
        const isSub = field.startsWith('Sub');
        if (isSub) {
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
      const member = memberId ? memberMap.get(memberId) || null : null;
      const availabilityStatus = status?.status?.name as AvailabilityStatus || AvailabilityStatus.AwaitingApproval;

      // A seat is available for assignment if:
      // 1. No member is assigned AND status is "Awaiting Approval"
      // (If someone is assigned, the seat is taken regardless of status)
      const isAvailable = !member && availabilityStatus === AvailabilityStatus.AwaitingApproval;

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
    console.error('Error creating detailed outing:', error);
    return null;
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
