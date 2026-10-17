// What members need to know before a test, as the current test drawer shows it
// (src/app/(app shell)/swim-tests/TestDrawer.tsx, "Information").

export type InfoSection = { title: string; text?: string[]; list?: string[]; after?: string[] };

export const SIGNUP_NOTE =
  'Add your name to an available slot. Mark the outcome of your test beside your name. If you do not provide an outcome, we will assume you did not attend.';

const WHEN: InfoSection = { title: 'When to arrive', text: ['Please arrive promptly at your booked time slot.'] };

const CAPSIZE: InfoSection[] = [
  {
    title: 'Where to go',
    text: [
      'Swim tests take place at the Rosenblatt Pool in the Iffley Road Sports Centre. Inside the lobby, look for the OURCs desk (not the main reception desk). There will be a sign on the desk saying "Capsize Drills", and someone there will be signing people in.',
    ],
  },
  WHEN,
  {
    title: 'Test details',
    text: [
      'The test tests your ability to safely capsize and then get your boat the correct way up and back to shore.',
      'You will receive an email once you have confirmed your availability. OURC will send you a full breakdown of the test with a link to a short online test which you must take and pass beforehand.',
    ],
  },
];

const SWIM: InfoSection[] = [
  {
    title: 'Where to go',
    text: [
      'Swim tests take place at the Rosenblatt Pool in the Iffley Road Sports Centre. Inside the lobby, look for the OURCs desk (not the main reception desk). There will be a sign on the desk saying "Swim Tests", and someone there will be signing people in.',
    ],
  },
  WHEN,
  {
    title: 'What to wear',
    text: ['You must take the swim test in clothes or sports kit:'],
    list: ['A T-shirt or equivalent (no sleeveless tops).', 'Shorts or lycra-style leggings (not baggy).'],
    after: ["Goggles are allowed. Swim caps that you wouldn't normally wear while rowing are not permitted."],
  },
  {
    title: 'What to bring',
    list: [
      'A towel.',
      'A change of clothes for after the test.',
      'A bag for wet clothes.',
      "Your Bod Card (or another form of ID if you don't have one).",
    ],
  },
  {
    title: 'What to do when you arrive',
    text: [
      'Before the test, you must sign in at the OURCs desk. An OURCs member (with a laptop) will record your name, college and Bod Card number.',
    ],
    list: ['This is not done at the Sports Centre reception or by swim instructors.', 'Look for the "Swim Tests" sign on the table.'],
    after: [
      "If you don't sign in, your swim test will not be recorded.",
      'After signing in, you will be shown a pre-test video before heading to the pool changing rooms to get changed and take the test.',
    ],
  },
  {
    title: 'What the swim test involves',
    list: ['50m swimming (last 5m underwater).', '2 minutes of treading water.'],
  },
];

export function testInfo(type: string | null): InfoSection[] {
  return type === 'Capsize Drill' ? CAPSIZE : SWIM;
}
