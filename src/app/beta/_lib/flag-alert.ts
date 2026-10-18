// The shell's red/black flag line (PER-278): read on the server in the beta layout, so it's in the
// first paint (no layout shift) and, as layouts persist across client navigation, read once per
// visit. The fetch is in Next's data cache for a minute, so pages stay as static as they were.
import { flagLabel, isNoGoFlag } from './home-data';

const FLAG_URL = 'https://ourcs.co.uk/api/flags/status/isis/';
const TIMEOUT_MS = 2_000;

/** "Red flag" / "Black flag" when no crews may go out; null otherwise or when OURCS is unreachable. */
export async function noGoFlagLabel(): Promise<string | null> {
  try {
    const res = await Promise.race([
      fetch(FLAG_URL, { next: { revalidate: 60 } }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
    ]);
    if (!res.ok) return null;
    const text = ((await res.json()) as { status_text?: unknown } | null)?.status_text;
    return typeof text === 'string' && isNoGoFlag(text) ? flagLabel(text) : null;
  } catch {
    return null;
  }
}
