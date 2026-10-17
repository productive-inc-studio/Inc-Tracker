-- Deleting a member must never wipe their time/comment history (it feeds past KPIs).
-- Members with history are deactivated (role = pending) instead of deleted.
alter table public.wt_time_entries drop constraint wt_time_entries_member_id_fkey,
  add constraint wt_time_entries_member_id_fkey foreign key (member_id) references public.wt_members (id) on delete restrict;
alter table public.wt_comments drop constraint wt_comments_member_id_fkey,
  add constraint wt_comments_member_id_fkey foreign key (member_id) references public.wt_members (id) on delete restrict;
