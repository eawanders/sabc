// The slot picker's rows: "Book me", "Clear slot", members matching the search (anyone already in
// another slot of this test is left out, as in the current app), then "Add … as a guest".
export type SlotPickerItem<M extends { id: string; name: string }> =
  | { kind: 'me'; member: M }
  | { kind: 'clear' }
  | { kind: 'member'; member: M }
  | { kind: 'guest'; name: string };

export function slotPickerItems<M extends { id: string; name: string }>(opts: {
  members: M[];
  query: string;
  taken: Record<string, number>; // member id → slot they hold in this test
  current: string | null; // who is in this slot
  me: string | null;
}): SlotPickerItem<M>[] {
  const name = opts.query.trim().replace(/\s+/g, ' ');
  const q = name.toLowerCase();
  const items: SlotPickerItem<M>[] = [];
  const meMember = opts.me ? opts.members.find((m) => m.id === opts.me) : undefined;
  if (!q && meMember && opts.taken[meMember.id] === undefined) items.push({ kind: 'me', member: meMember });
  if (!q && opts.current) items.push({ kind: 'clear' });
  const matches = opts.members
    .filter((m) => m.name.toLowerCase().includes(q))
    .filter((m) => opts.taken[m.id] === undefined || m.id === opts.current)
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const member of matches) items.push({ kind: 'member', member });
  if (name && !opts.members.some((m) => m.name.toLowerCase() === name.toLowerCase())) items.push({ kind: 'guest', name });
  return items;
}
