// src/app/(app shell)/schedule/[[...params]]/page.tsx

import SchedulePageWithParams from './page.client';

export const metadata = { title: 'Outings' };

export default function SchedulePage({
  params,
}: {
  params: Promise<{ params?: string[] }>;
}) {
  return <SchedulePageWithParams params={params} />;
}