'use client';
import { useEffect, useState } from 'react';

/** The current time, refreshed every minute (so finished outings lock without a reload). */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}
