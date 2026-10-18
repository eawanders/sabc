// Browser-side, read-only directory data (anon key): members.
// Loaded once per page session and shared by the identity picker and the crew drawer.
import { getBrowserClient } from '@/lib/live/realtime';

export type DirectoryMember = { id: string; name: string; member_type: string[] };

let members: Promise<DirectoryMember[]> | null = null;

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
