// One-off: full inbound sync, then backfill app-owned data (seats, reports,
// unavailability, swim-test slots, marshal sign-ups) from Notion into Postgres.
//
//   npx -y tsx --env-file=.env.local scripts/sync-backfill.ts --dry-run
//   npx -y tsx --env-file=.env.local scripts/sync-backfill.ts
//
// Flags: --dry-run (read and count, write nothing to the app-owned tables; the
// inbound sync of Notion-owned tables still runs unless --skip-sync),
// --skip-sync, --overwrite (also replace rows the app has already changed).
// Needs NOTION_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Reads Notion only.
import { backfillAppOwned } from '../src/server/sync/backfill';
import { createServiceRoleSyncDb } from '../src/server/sync/db';
import { syncAll } from '../src/server/sync/inbound';
import { createSyncNotion } from '../src/server/sync/notionApi';

async function main() {
  const args = new Set(process.argv.slice(2));
  const db = createServiceRoleSyncDb();
  const notion = createSyncNotion();

  if (!args.has('--skip-sync')) {
    const inbound = await syncAll(notion, db, { full: true });
    console.table(inbound);
    if (inbound.some((r) => r.error || !r.complete)) {
      throw new Error('Inbound sync did not complete; not backfilling.');
    }
  }

  const result = await backfillAppOwned(notion, db, {
    dryRun: args.has('--dry-run'),
    overwrite: args.has('--overwrite'),
  });
  console.table(result);
  if (args.has('--dry-run')) console.log('Dry run: nothing written to app-owned tables.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
