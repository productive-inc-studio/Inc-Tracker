-- Total tracked time per task, kept in sync from time entries so every viewer of a task sees the same total.
alter table public.wt_tasks add column tracked_minutes int not null default 0;

create function public.wt_sync_tracked_minutes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare t uuid;
begin
  for t in select distinct x from unnest(array[
    case when tg_op <> 'INSERT' then old.task_id end,
    case when tg_op <> 'DELETE' then new.task_id end]) x where x is not null
  loop
    update public.wt_tasks
       set tracked_minutes = coalesce((select sum(minutes) from public.wt_time_entries where task_id = t), 0)
     where id = t;
  end loop;
  return null;
end $$;
revoke execute on function public.wt_sync_tracked_minutes() from public, anon, authenticated;

create trigger wt_time_entries_sync after insert or update or delete on public.wt_time_entries
  for each row execute function public.wt_sync_tracked_minutes();
