-- WorkTracker v2 schema
-- Every object is prefixed with wt_ because this database is shared with other apps.
-- Roles: admin (everything + members), lead (sees/assigns all tasks), member (own tasks), pending (no access).

-- ─── Types ──────────────────────────────────────────────────────────────────
create type public.wt_role as enum ('admin', 'lead', 'member', 'pending');
create type public.wt_status as enum ('todo', 'in_progress', 'review', 'done');
create type public.wt_priority as enum ('urgent', 'high', 'normal', 'low');

-- ─── Tables ─────────────────────────────────────────────────────────────────
create table public.wt_members (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  avatar_url text,
  title text,
  role public.wt_role not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.wt_invites (
  email text primary key check (email = lower(email)),
  role public.wt_role not null default 'member' check (role <> 'pending'),
  invited_by uuid references public.wt_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.wt_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  client text,
  color text not null default '#7c5cff',
  archived boolean not null default false,
  created_by uuid default auth.uid() references public.wt_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.wt_task_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  emoji text not null default '✨',
  sort int not null default 0
);

create table public.wt_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  status public.wt_status not null default 'todo',
  priority public.wt_priority not null default 'normal',
  project_id uuid references public.wt_projects (id) on delete set null,
  type_id uuid references public.wt_task_types (id) on delete set null,
  assignee_id uuid references public.wt_members (id) on delete set null,
  created_by uuid default auth.uid() references public.wt_members (id) on delete set null,
  start_date date,
  due_date date,
  estimate_minutes int check (estimate_minutes >= 0),
  completed_at timestamptz,
  position double precision not null default extract(epoch from now()),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index wt_tasks_assignee_idx on public.wt_tasks (assignee_id);
create index wt_tasks_due_idx on public.wt_tasks (due_date);
create index wt_tasks_project_idx on public.wt_tasks (project_id);

create table public.wt_time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.wt_tasks (id) on delete cascade,
  member_id uuid not null default auth.uid() references public.wt_members (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  minutes int generated always as (
    case when ended_at is null then null
         else round(extract(epoch from (ended_at - started_at)) / 60)::int end
  ) stored,
  note text,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
create index wt_time_entries_task_idx on public.wt_time_entries (task_id);
create index wt_time_entries_member_started_idx on public.wt_time_entries (member_id, started_at);
-- one running timer per person
create unique index wt_time_entries_one_running on public.wt_time_entries (member_id) where ended_at is null;

create table public.wt_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.wt_tasks (id) on delete cascade,
  member_id uuid not null default auth.uid() references public.wt_members (id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index wt_comments_task_idx on public.wt_comments (task_id);

-- ─── Permission helpers ─────────────────────────────────────────────────────
create function public.wt_my_role() returns public.wt_role
language sql stable security definer set search_path = '' as $$
  select role from public.wt_members where id = auth.uid()
$$;

create function public.wt_is_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.wt_my_role() in ('admin', 'lead', 'member'), false)
$$;

create function public.wt_is_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.wt_my_role() in ('admin', 'lead'), false)
$$;

create function public.wt_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.wt_my_role() = 'admin', false)
$$;

create function public.wt_can_see_task(p_task uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.wt_is_active() and exists (
    select 1 from public.wt_tasks t
    where t.id = p_task
      and (public.wt_is_manager() or t.assignee_id = auth.uid() or t.created_by = auth.uid())
  )
$$;

-- ─── Triggers ───────────────────────────────────────────────────────────────
create function public.wt_tasks_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end $$;
create trigger wt_tasks_before_write before insert or update on public.wt_tasks
  for each row execute function public.wt_tasks_before_write();

-- Only admins may change role/email; never remove the last admin.
create function public.wt_members_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.wt_is_admin() and coalesce(current_setting('wt.claiming_invite', true), '') <> 'on' then
    new.role := old.role;
    new.email := old.email;
  end if;
  if old.role = 'admin' and new.role <> 'admin'
     and (select count(*) from public.wt_members where role = 'admin') <= 1 then
    raise exception 'ต้องมี Admin อย่างน้อย 1 คน';
  end if;
  return new;
end $$;
create trigger wt_members_guard before update on public.wt_members
  for each row execute function public.wt_members_guard();

-- ─── RPCs ───────────────────────────────────────────────────────────────────
-- Called after sign-in: creates (or upgrades) the caller's member row.
-- Only Google identities can join, so an unverified email sign-up cannot claim an invite.
create function public.wt_ensure_member() returns public.wt_members
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  m public.wt_members;
  inv public.wt_invites;
  u record;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from auth.identities where user_id = uid and provider = 'google') then
    raise exception 'google_required';
  end if;

  select * into m from public.wt_members where id = uid;
  if found then
    if m.role = 'pending' then
      select * into inv from public.wt_invites where email = m.email;
      if found then
        perform set_config('wt.claiming_invite', 'on', true);
        update public.wt_members set role = inv.role where id = uid returning * into m;
        perform set_config('wt.claiming_invite', 'off', true);
        delete from public.wt_invites where email = inv.email;
      end if;
    end if;
    return m;
  end if;

  select lower(email) as email,
         coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', split_part(email, '@', 1)) as name,
         raw_user_meta_data ->> 'avatar_url' as avatar
    into u from auth.users where id = uid;
  select * into inv from public.wt_invites where email = u.email;

  insert into public.wt_members (id, email, full_name, avatar_url, role)
  values (uid, u.email, u.name, u.avatar, coalesce(inv.role, 'pending'))
  returning * into m;
  if inv.email is not null then delete from public.wt_invites where email = inv.email; end if;
  return m;
end $$;

create function public.wt_start_timer(p_task uuid) returns public.wt_time_entries
language plpgsql set search_path = '' as $$
declare e public.wt_time_entries;
begin
  if not public.wt_can_see_task(p_task) then raise exception 'ไม่มีสิทธิ์ในงานนี้'; end if;
  update public.wt_time_entries set ended_at = now() where member_id = auth.uid() and ended_at is null;
  insert into public.wt_time_entries (task_id, member_id) values (p_task, auth.uid()) returning * into e;
  update public.wt_tasks set status = 'in_progress' where id = p_task and status = 'todo';
  return e;
end $$;

create function public.wt_stop_timer() returns setof public.wt_time_entries
language sql set search_path = '' as $$
  update public.wt_time_entries set ended_at = now()
  where member_id = auth.uid() and ended_at is null
  returning *
$$;

-- ─── Row Level Security ─────────────────────────────────────────────────────
alter table public.wt_members enable row level security;
alter table public.wt_invites enable row level security;
alter table public.wt_projects enable row level security;
alter table public.wt_task_types enable row level security;
alter table public.wt_tasks enable row level security;
alter table public.wt_time_entries enable row level security;
alter table public.wt_comments enable row level security;

create policy "members: active see all, pending see self" on public.wt_members for select to authenticated
  using (public.wt_is_active() or id = auth.uid());
create policy "members: self or admin update" on public.wt_members for update to authenticated
  using (id = auth.uid() or public.wt_is_admin());
create policy "members: admin delete" on public.wt_members for delete to authenticated
  using (public.wt_is_admin() and id <> auth.uid());

create policy "invites: admin" on public.wt_invites for all to authenticated
  using (public.wt_is_admin()) with check (public.wt_is_admin());

create policy "projects: active read" on public.wt_projects for select to authenticated
  using (public.wt_is_active());
create policy "projects: manager insert" on public.wt_projects for insert to authenticated
  with check (public.wt_is_manager());
create policy "projects: manager update" on public.wt_projects for update to authenticated
  using (public.wt_is_manager());
create policy "projects: manager delete" on public.wt_projects for delete to authenticated
  using (public.wt_is_manager());

create policy "types: active read" on public.wt_task_types for select to authenticated
  using (public.wt_is_active());
create policy "types: manager insert" on public.wt_task_types for insert to authenticated
  with check (public.wt_is_manager());
create policy "types: manager update" on public.wt_task_types for update to authenticated
  using (public.wt_is_manager());
create policy "types: manager delete" on public.wt_task_types for delete to authenticated
  using (public.wt_is_manager());

create policy "tasks: read" on public.wt_tasks for select to authenticated
  using (public.wt_is_active() and (public.wt_is_manager() or assignee_id = auth.uid() or created_by = auth.uid()));
create policy "tasks: insert" on public.wt_tasks for insert to authenticated
  with check (public.wt_is_active() and created_by = auth.uid()
              and (public.wt_is_manager() or assignee_id is null or assignee_id = auth.uid()));
create policy "tasks: update" on public.wt_tasks for update to authenticated
  using (public.wt_is_active() and (public.wt_is_manager() or assignee_id = auth.uid() or created_by = auth.uid()))
  with check (public.wt_is_manager() or assignee_id is null or assignee_id = auth.uid());
create policy "tasks: delete" on public.wt_tasks for delete to authenticated
  using (public.wt_is_active() and (public.wt_is_manager() or created_by = auth.uid()));

create policy "time: read" on public.wt_time_entries for select to authenticated
  using (public.wt_is_active() and (public.wt_is_manager() or member_id = auth.uid()));
create policy "time: insert own" on public.wt_time_entries for insert to authenticated
  with check (member_id = auth.uid() and public.wt_can_see_task(task_id));
create policy "time: update own or manager" on public.wt_time_entries for update to authenticated
  using (public.wt_is_active() and (member_id = auth.uid() or public.wt_is_manager()));
create policy "time: delete own or manager" on public.wt_time_entries for delete to authenticated
  using (public.wt_is_active() and (member_id = auth.uid() or public.wt_is_manager()));

create policy "comments: read" on public.wt_comments for select to authenticated
  using (public.wt_can_see_task(task_id));
create policy "comments: insert own" on public.wt_comments for insert to authenticated
  with check (member_id = auth.uid() and public.wt_can_see_task(task_id));
create policy "comments: delete own or admin" on public.wt_comments for delete to authenticated
  using (member_id = auth.uid() or public.wt_is_admin());

-- Nothing here is for signed-out visitors.
revoke all on public.wt_members, public.wt_invites, public.wt_projects, public.wt_task_types,
  public.wt_tasks, public.wt_time_entries, public.wt_comments from anon;
revoke execute on function public.wt_ensure_member(), public.wt_start_timer(uuid), public.wt_stop_timer() from anon, public;
grant execute on function public.wt_ensure_member(), public.wt_start_timer(uuid), public.wt_stop_timer() to authenticated;

-- Live updates for the board
alter publication supabase_realtime add table public.wt_tasks, public.wt_time_entries, public.wt_comments;

-- ─── Seed ───────────────────────────────────────────────────────────────────
insert into public.wt_task_types (name, emoji, sort) values
  ('Graphic Design', '🎨', 1), ('Content', '✍️', 2), ('Motion', '🎬', 3), ('Editor', '✂️', 4),
  ('Shooting', '📸', 5), ('Planning', '📋', 6), ('Meeting', '💬', 7), ('Other', '📦', 8);

-- Studio owner becomes the first admin on their first Google sign-in.
insert into public.wt_invites (email, role) values ('productive.inc.studio@gmail.com', 'admin');
