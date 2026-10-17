-- PER-275: run the incremental Notion sync every 5 minutes instead of every
-- minute. Each run is a 6-15 s Vercel function; every minute that would use
-- about half of the Hobby plan's monthly memory allowance (a hard cap that
-- pauses every function in the app when hit). Every 5 minutes uses ~1/10.
-- cron.schedule with an existing job name updates that job.
select cron.schedule('notion-sync', '*/5 * * * *', $$ select public.trigger_notion_sync(false) $$);
