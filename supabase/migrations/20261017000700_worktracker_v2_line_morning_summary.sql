-- Daily LINE summary at 09:00 Bangkok (02:00 UTC), sent by pg_cron through the wt-line-notify function.
-- The function trusts the call only when it carries the random key stored in the vault as `wt_cron_key`.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- random key, generated here so it never appears in the repository
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'wt_cron_key', 'WorkTracker: authorizes scheduled calls to wt-line-notify')
where not exists (select 1 from vault.secrets where name = 'wt_cron_key');

create function public.wt_cron_key_valid(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'wt_cron_key' and decrypted_secret = p_key)
$$;
revoke execute on function public.wt_cron_key_valid(text) from public, anon, authenticated;
grant execute on function public.wt_cron_key_valid(text) to service_role;

-- The anon key below is public (it is in the web app too); the cron key is read from the vault at run time.
select cron.schedule(
  'wt-line-morning-summary',
  '0 2 * * *',
  $job$
  select net.http_post(
    url := 'https://jsywdxdhycfjdbhgogjs.supabase.co/functions/v1/wt-line-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeXdkeGRoeWNmamRiaGdvZ2pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0OTg5NjgsImV4cCI6MjA5NjA3NDk2OH0.HctVq88sFh2Nwqga5_vfey4P85bdlybEevVXDsmr8n4',
      'x-cron-key', (select decrypted_secret from vault.decrypted_secrets where name = 'wt_cron_key')
    ),
    body := '{"kind":"summary","schedule":"morning"}'::jsonb,
    timeout_milliseconds := 30000
  )
  $job$
);
