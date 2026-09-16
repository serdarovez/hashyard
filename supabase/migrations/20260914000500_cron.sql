-- Scheduled jobs. Supabase only - the local test runner skips this file.
--
-- Before running it:
--   1. Dashboard -> Database -> Extensions: enable pg_cron and pg_net.
--   2. In the SQL editor, store two secrets once (Vault encrypts them):
--        select vault.create_secret('https://YOUR-PROJECT-REF.supabase.co', 'project_url');
--        select vault.create_secret('the same random string as the CRON_SECRET function secret', 'cron_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Release stock held by unpaid orders once their hour is up.
select cron.schedule('hashyard-expire-orders', '* * * * *', $$ select public.expire_orders(); $$);

-- Look for new payments every minute.
select cron.schedule('hashyard-scan-payments', '* * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/payments',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
$$);

-- Daily update emails at 09:00 UTC, for yesterday - if you have published it.
select cron.schedule('hashyard-daily-email', '0 9 * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/daily-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
