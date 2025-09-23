import { Member } from '@/types/members';

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
 * Maps outing time to coxing availability time slot
 */
export function getTimeSlotForOuting(outingTime: string): 'earlyAM' | 'midAM' | 'midPM' | 'latePM' {
  const hour = new Date(outingTime).getHours();

  if (hour >= 6 && hour < 8) return 'earlyAM';
  if (hour >= 8 && hour < 12) return 'midAM';
  if (hour >= 12 && hour < 17) return 'midPM'; // 12PM-5PM
  if (hour >= 17 && hour < 20) return 'latePM'; // 5PM-8PM

  // Default to midPM for any other times
  return 'midPM';
}

/**
 * Filters available coxes based on eligibility and availability for a specific outing
 */
export function getEligibleCoxes(
  allMembers: Member[],
  flagStatus: FlagStatus,
  outingDate: string,
  outingTime: string,
  coxingAvailability: Array<{
    date: string;
    earlyAM: string[];
    midAM: string[];
    midPM: string[];
    latePM: string[];
  }>
): Member[] {
  const timeSlot = getTimeSlotForOuting(outingTime);

  // Find availability for the outing date
  const dateAvailability = coxingAvailability.find(
    avail => avail.date === outingDate
  );

  if (!dateAvailability) {
    // No availability data for this date, return only eligible coxes
    return allMembers.filter(member =>
      isCoxEligible(member.coxExperience, flagStatus)
    );
  }

  // Get available member IDs for the time slot
  const availableMemberIds = dateAvailability[timeSlot] || [];

  // Filter members who are both eligible and available
  return allMembers.filter(member =>
    isCoxEligible(member.coxExperience, flagStatus) &&
    availableMemberIds.includes(member.id)
  );
}