// src/app/(app shell)/schedule/[[...params]]/page.tsx

import { Suspense } from 'react';
import SchedulePageWithParams from './page.client';

export const metadata = { title: 'Outings' };

export default function SchedulePage({
  params,
}: {
  params: Promise<{ params?: string[] }>;
}) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SchedulePageWithParams params={params} />
    </Suspense>
  );
}