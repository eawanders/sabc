// src/app/(app shell)/marshalling/page.tsx

import MarshallingPageClient from './MarshallingPageClient';

export const metadata = { title: 'Marshalling & Umpires' };
export const dynamic = 'force-dynamic';

export default function MarshallingPage() {
  return <MarshallingPageClient />;
}
