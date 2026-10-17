-- In-app notifications, written by triggers so every client gets them the same way.
-- kinds: assigned (task given to you), subtask_assigned, comment (on a task you own/created),
--        done (a task you created was finished), review (a task you created is waiting for review)

create table public.wt_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.wt_members (id) on delete cascade,
  actor_id uuid references public.wt_members (id) on delete set null,
  kind text not null,
  task_id uuid references public.wt_tasks (id) on delete cascade,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index wt_notifications_recipient_idx on public.wt_notifications (recipient_id, created_at desc);

alter table public.wt_notifications enable row level security;
create policy "notifications: own read" on public.wt_notifications for select to authenticated
  using (recipient_id = auth.uid());
create policy "notifications: own mark read" on public.wt_notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy "notifications: own delete" on public.wt_notifications for delete to authenticated
  using (recipient_id = auth.uid());
revoke all on public.wt_notifications from anon;
revoke insert on public.wt_notifications from authenticated;
alter publication supabase_realtime add table public.wt_notifications;

-- Never notify people about their own actions, nor members who were deactivated.
create function public.wt_notify(p_recipient uuid, p_kind text, p_task uuid, p_title text, p_body text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_recipient is null or p_recipient = auth.uid() then return; end if;
  if not exists (select 1 from public.wt_members where id = p_recipient and role <> 'pending') then return; end if;
  insert into public.wt_notifications (recipient_id, actor_id, kind, task_id, title, body)
  values (p_recipient, auth.uid(), p_kind, p_task, p_title, p_body);
end $$;

create function public.wt_tasks_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.assignee_id is not null and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    perform public.wt_notify(new.assignee_id, 'assigned', new.id, new.title);
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'done' then
      perform public.wt_notify(new.created_by, 'done', new.id, new.title);
    elsif new.status = 'review' then
      perform public.wt_notify(new.created_by, 'review', new.id, new.title);
    end if;
  end if;
  return null;
end $$;
create trigger wt_tasks_notify after insert or update of assignee_id, status on public.wt_tasks
  for each row execute function public.wt_tasks_notify();

create function public.wt_subtasks_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare parent text;
begin
  if new.assignee_id is not null and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    select title into parent from public.wt_tasks where id = new.task_id;
    perform public.wt_notify(new.assignee_id, 'subtask_assigned', new.task_id, new.title, parent);
  end if;
  return null;
end $$;
create trigger wt_subtasks_notify after insert or update of assignee_id on public.wt_subtasks
  for each row execute function public.wt_subtasks_notify();

create function public.wt_comments_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare t public.wt_tasks;
begin
  select * into t from public.wt_tasks where id = new.task_id;
  perform public.wt_notify(t.assignee_id, 'comment', t.id, t.title, left(new.body, 140));
  if t.created_by is distinct from t.assignee_id then
    perform public.wt_notify(t.created_by, 'comment', t.id, t.title, left(new.body, 140));
  end if;
  return null;
end $$;
create trigger wt_comments_notify after insert on public.wt_comments
  for each row execute function public.wt_comments_notify();

revoke execute on function public.wt_notify(uuid, text, uuid, text, text), public.wt_tasks_notify(),
  public.wt_subtasks_notify(), public.wt_comments_notify() from public, anon, authenticated;
