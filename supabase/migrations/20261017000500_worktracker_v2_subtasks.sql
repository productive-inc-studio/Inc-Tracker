-- Subtasks: a task can be split into items, each with its own status, assignee and due date.
-- Whoever is assigned a subtask can also see (but not edit) the parent task.

create table public.wt_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.wt_tasks (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  status public.wt_status not null default 'todo',
  assignee_id uuid references public.wt_members (id) on delete set null,
  due_date date,
  position double precision not null default extract(epoch from clock_timestamp()),
  completed_at timestamptz,
  created_by uuid default auth.uid() references public.wt_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index wt_subtasks_task_idx on public.wt_subtasks (task_id);
create index wt_subtasks_assignee_idx on public.wt_subtasks (assignee_id);

-- ─── Permission helpers ─────────────────────────────────────────────────────
create function public.wt_has_subtask(p_task uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.wt_subtasks where task_id = p_task and assignee_id = auth.uid())
$$;

-- Can edit the task itself (and manage its subtasks).
create function public.wt_can_edit_task(p_task uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.wt_is_active() and exists (
    select 1 from public.wt_tasks t
    where t.id = p_task
      and (public.wt_is_manager() or t.assignee_id = auth.uid() or t.created_by = auth.uid())
  )
$$;

create or replace function public.wt_can_see_task(p_task uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.wt_can_edit_task(p_task) or (public.wt_is_active() and public.wt_has_subtask(p_task))
$$;

revoke execute on function public.wt_has_subtask(uuid), public.wt_can_edit_task(uuid) from public, anon;
grant execute on function public.wt_has_subtask(uuid), public.wt_can_edit_task(uuid) to authenticated;

drop policy "tasks: read" on public.wt_tasks;
create policy "tasks: read" on public.wt_tasks for select to authenticated
  using (public.wt_is_active() and (public.wt_is_manager() or assignee_id = auth.uid() or created_by = auth.uid()
                                    or public.wt_has_subtask(id)));

-- ─── Triggers ───────────────────────────────────────────────────────────────
create function public.wt_subtasks_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- members may only hand a subtask to themselves (or leave it unassigned)
  if not public.wt_is_manager()
     and new.assignee_id is not null and new.assignee_id <> auth.uid()
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    raise exception 'Member มอบหมายข้อย่อยได้เฉพาะตัวเอง';
  end if;
  new.updated_at := now();
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end $$;
create trigger wt_subtasks_before_write before insert or update on public.wt_subtasks
  for each row execute function public.wt_subtasks_before_write();

-- Starting work on a subtask moves a parent that is still "To Do" to "In progress".
create function public.wt_subtasks_bump_parent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'todo' then
    update public.wt_tasks set status = 'in_progress' where id = new.task_id and status = 'todo';
  end if;
  return null;
end $$;
create trigger wt_subtasks_bump_parent after insert or update of status on public.wt_subtasks
  for each row execute function public.wt_subtasks_bump_parent();

revoke execute on function public.wt_subtasks_before_write(), public.wt_subtasks_bump_parent() from public, anon, authenticated;

-- ─── Row Level Security ─────────────────────────────────────────────────────
alter table public.wt_subtasks enable row level security;

create policy "subtasks: read" on public.wt_subtasks for select to authenticated
  using (public.wt_can_see_task(task_id));
create policy "subtasks: insert" on public.wt_subtasks for insert to authenticated
  with check (public.wt_can_edit_task(task_id));
create policy "subtasks: update" on public.wt_subtasks for update to authenticated
  using (public.wt_can_edit_task(task_id) or (public.wt_is_active() and assignee_id = auth.uid()))
  with check (public.wt_can_see_task(task_id));
create policy "subtasks: delete" on public.wt_subtasks for delete to authenticated
  using (public.wt_can_edit_task(task_id));

revoke all on public.wt_subtasks from anon;
alter publication supabase_realtime add table public.wt_subtasks;
