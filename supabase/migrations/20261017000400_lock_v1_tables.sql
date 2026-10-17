-- Lock the WorkTracker v1 tables. The v2 app only uses wt_* tables; the old
-- single-file site read/wrote these directly with the anon key and RLS off.
-- RLS with no policies blocks anon/authenticated; the data stays in place
-- (backup in supabase/backup/, not committed). service_role still has access.

alter table public.tasks      enable row level security;
alter table public.workers    enable row level security;
alter table public.task_types enable row level security;
alter table public.checkins   enable row level security;
alter table public.line_logs  enable row level security;
alter table public.profiles   enable row level security;

revoke all on public.tasks, public.workers, public.task_types,
              public.checkins, public.line_logs, public.profiles
  from anon, authenticated;
