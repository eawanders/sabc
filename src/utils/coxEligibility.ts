import { Member } from '@/types/members';
import { DayOfWeek, TimeRange } from '@/types/rowerAvailability';
import { isRowerAvailable, extractTime } from '@/utils/rowerAvailability';

export type CoxExperience = "Novice" | "Novice (less than 1 term)" | "Experienced" | "Senior";
export type FlagStatus = "green" | "light-blue" | "dark-blue" | "red" | "grey" | "black";

/**
 * Determines if a cox is eligible based on their experience level and the current flag status
 */
export function isCoxEligible(coxExperience: string | undefined, flagStatus: FlagStatus): boolean {
  if (!coxExperience) return false;

  switch (flagStatus) {
    case "green":
      // All coxes eligible
      return true;

    case "light-blue":
      // Experienced/Senior/Novice allowed (not Novice with less than one term)
      return coxExperience === "Experienced" ||
             coxExperience === "Senior" ||
             coxExperience === "Novice";

    case "dark-blue":
      // No novices (Experienced/Senior only)
      return coxExperience === "Experienced" || coxExperience === "Senior";

    case "red":
      // No coxing allowed
      return false;

    case "grey":
      // Any cox experience level is allowed
      return true;

    case "black":
      // No coxing allowed
      return false;

    default:
      return false;
  }
}

/**
 * Filters available coxes using the unified availability system
 * Uses Members DB "Unavailable [Day]" properties where data represents UNavailability
 */
export function getEligibleCoxesUnified(
  allMembers: Member[],
  flagStatus: FlagStatus,
  outingDate: string,
  outingTime: string,
  availabilityMap: Map<string, Record<DayOfWeek, TimeRange[]>>
): Member[] {
  const sessionTime = extractTime(outingTime);

  // Filter members who are eligible
  const eligibleCoxes = allMembers.filter(member =>
    isCoxEligible(member.coxExperience, flagStatus)
  );

  // Further filter by availability
  // A cox is available if they have NOT marked this time as unavailable
  return eligibleCoxes.filter(member => {
    const memberAvailability = availabilityMap.get(member.id);

    // If no unavailability data, they're available
    if (!memberAvailability) {
      return true;
    }

    // Check if they're available at the specific time
    return isRowerAvailable(memberAvailability, outingDate, sessionTime);
  });
}
