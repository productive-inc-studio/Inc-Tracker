-- Helpers are needed by RLS policies for signed-in users only; trigger functions by nobody.
revoke execute on function public.wt_my_role(), public.wt_is_active(), public.wt_is_manager(),
  public.wt_is_admin(), public.wt_can_see_task(uuid) from public, anon;
grant execute on function public.wt_my_role(), public.wt_is_active(), public.wt_is_manager(),
  public.wt_is_admin(), public.wt_can_see_task(uuid) to authenticated;
revoke execute on function public.wt_members_guard(), public.wt_tasks_before_write() from public, anon, authenticated;
