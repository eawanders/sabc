// src/app/tests/[[...params]]/page.tsx

import TestsPageWithParams from './page.client';

export const metadata = { title: 'Tests' };

export default function TestsPage({
  params,
}: {
  params: Promise<{ params?: string[] }>;
}) {
  return <TestsPageWithParams params={params} />;
}