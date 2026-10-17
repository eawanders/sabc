// Browser-side, read-only directory data (anon key): members and their weekly unavailability.
// Loaded once per page session and shared by the identity picker and the crew drawer.
import { getBrowserClient } from '@/lib/live/realtime';
import type { WeeklyUnavailability } from './availability';

export type DirectoryMember = { id: string; name: string; member_type: string[] };

let members: Promise<DirectoryMember[]> | null = null;
let unavailability: Promise<Record<string, WeeklyUnavailability>> | null = null;

export function loadMembers(): Promise<DirectoryMember[]> {
  if (!members) {
    members = (async () => {
      const client = getBrowserClient();
      if (!client) return [];
      const { data, error } = await client.from('members').select('id, name, member_type').order('name');
      if (error) throw new Error(error.message);
      return (data ?? []) as DirectoryMember[];
    })();
    members.catch(() => {
      members = null; // let the next caller retry
    });
  }
  return members;
}

export function loadUnavailability(): Promise<Record<string, WeeklyUnavailability>> {
  if (!unavailability) {
    unavailability = (async () => {
      const client = getBrowserClient();
      if (!client) return {};
      const { data, error } = await client
        .from('member_unavailability')
        .select('member_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday');
      if (error) throw new Error(error.message);
      const out: Record<string, WeeklyUnavailability> = {};
      for (const row of data ?? []) {
        const { member_id, ...days } = row as { member_id: string } & WeeklyUnavailability;
        out[member_id] = days;
      }
      return out;
    })();
    unavailability.catch(() => {
      unavailability = null;
    });
  }
  return unavailability;
}
