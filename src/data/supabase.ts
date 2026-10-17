import { createClient, type PostgrestError } from '@supabase/supabase-js'
import type { Api } from './api'
import type { Member, Task, TimeEntry } from '../lib/types'

// The anon key is public by design; Row Level Security in supabase/migrations decides what each user can see.
const SUPABASE_URL = 'https://jsywdxdhycfjdbhgogjs.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeXdkeGRoeWNmamRiaGdvZ2pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0OTg5NjgsImV4cCI6MjA5NjA3NDk2OH0.HctVq88sFh2Nwqga5_vfey4P85bdlybEevVXDsmr8n4'

/** OAuth failures come back as ?error_description=… (or in the #fragment). supabase-js strips them during init,
 *  so read the message before the client is created. */
export const redirectError = (() => {
  const url = new URL(window.location.href)
  const msg = url.searchParams.get('error_description') ?? new URLSearchParams(url.hash.replace(/^#\/?/, '')).get('error_description')
  if (msg) window.history.replaceState(null, '', url.origin + url.pathname + '#/')
  return msg
})()

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  // PKCE returns ?code= instead of a #access_token fragment, which would clash with the hash router.
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
})

export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
  })
}

function check<T>(res: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message)
  return res.data as NonNullable<T>
}

const TASK_COLUMNS = '*'

export const supabaseApi: Api = {
  async ensureMember() {
    return check(await supabase.rpc('wt_ensure_member')) as Member
  },
  async signOut() {
    await supabase.auth.signOut()
  },

  async listMembers() {
    return check(await supabase.from('wt_members').select('*').order('full_name'))
  },
  async updateMember(id, patch) {
    check(await supabase.from('wt_members').update(patch).eq('id', id))
  },
  async removeMember(id) {
    check(await supabase.from('wt_members').delete().eq('id', id))
  },
  async listInvites() {
    return check(await supabase.from('wt_invites').select('*').order('created_at'))
  },
  async createInvite(email, role) {
    const { data } = await supabase.auth.getUser()
    check(await supabase.from('wt_invites').upsert({ email: email.trim().toLowerCase(), role, invited_by: data.user?.id }))
  },
  async deleteInvite(email) {
    check(await supabase.from('wt_invites').delete().eq('email', email))
  },

  async listProjects() {
    return check(await supabase.from('wt_projects').select('*').order('name'))
  },
  async saveProject(p) {
    check(await supabase.from('wt_projects').upsert(p))
  },
  async deleteProject(id) {
    check(await supabase.from('wt_projects').delete().eq('id', id))
  },
  async listTypes() {
    return check(await supabase.from('wt_task_types').select('*').order('sort'))
  },
  async saveType(t) {
    check(await supabase.from('wt_task_types').upsert(t))
  },
  async deleteType(id) {
    check(await supabase.from('wt_task_types').delete().eq('id', id))
  },

  async listTasks() {
    return check(await supabase.from('wt_tasks').select(TASK_COLUMNS).order('position'))
  },
  async createTask(input) {
    const { data } = await supabase.auth.getUser()
    return check(
      await supabase.from('wt_tasks').insert({ ...input, created_by: data.user?.id }).select(TASK_COLUMNS).single(),
    ) as Task
  },
  async updateTask(id, patch) {
    check(await supabase.from('wt_tasks').update(patch).eq('id', id))
  },
  async deleteTask(id) {
    check(await supabase.from('wt_tasks').delete().eq('id', id))
  },

  async listSubtasks() {
    return check(await supabase.from('wt_subtasks').select('*').order('position'))
  },
  async createSubtask(taskId, input) {
    check(await supabase.from('wt_subtasks').insert({ ...input, task_id: taskId }))
  },
  async updateSubtask(id, patch) {
    check(await supabase.from('wt_subtasks').update(patch).eq('id', id))
  },
  async deleteSubtask(id) {
    check(await supabase.from('wt_subtasks').delete().eq('id', id))
  },

  async listTimeEntries(from, to) {
    return check(
      await supabase.from('wt_time_entries').select('*').gte('started_at', from).lt('started_at', to).order('started_at'),
    )
  },
  async listTaskTime(taskId) {
    return check(
      await supabase.from('wt_time_entries').select('*').eq('task_id', taskId).order('started_at', { ascending: false }),
    )
  },
  async runningTimer() {
    const { data } = await supabase.auth.getUser()
    if (!data.user) return null
    return check(
      await supabase.from('wt_time_entries').select('*').eq('member_id', data.user.id).is('ended_at', null).maybeSingle(),
    ) as TimeEntry | null
  },
  async startTimer(taskId) {
    check(await supabase.rpc('wt_start_timer', { p_task: taskId }))
  },
  async stopTimer() {
    check(await supabase.rpc('wt_stop_timer'))
  },
  async addTime(taskId, startedAt, minutes, note) {
    const { data } = await supabase.auth.getUser()
    const ended = new Date(new Date(startedAt).getTime() + minutes * 60_000).toISOString()
    check(
      await supabase
        .from('wt_time_entries')
        .insert({ task_id: taskId, member_id: data.user?.id, started_at: startedAt, ended_at: ended, note: note || null }),
    )
  },
  async deleteTime(id) {
    check(await supabase.from('wt_time_entries').delete().eq('id', id))
  },

  async listComments(taskId) {
    return check(await supabase.from('wt_comments').select('*').eq('task_id', taskId).order('created_at'))
  },
  async addComment(taskId, body) {
    const { data } = await supabase.auth.getUser()
    check(await supabase.from('wt_comments').insert({ task_id: taskId, member_id: data.user?.id, body }))
  },
  async deleteComment(id) {
    check(await supabase.from('wt_comments').delete().eq('id', id))
  },

  async notifyLine(payload) {
    const { error } = await supabase.functions.invoke('wt-line-notify', { body: payload })
    if (error) {
      let msg = error.message
      try {
        msg = (await error.context.json()).error ?? msg
      } catch {
        /* keep generic message */
      }
      throw new Error(msg)
    }
  },

  subscribe(onChange) {
    const channel = supabase
      .channel('wt-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wt_tasks' }, () => onChange('tasks'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wt_subtasks' }, () => onChange('subtasks'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wt_time_entries' }, () => onChange('time'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wt_comments' }, () => onChange('comments'))
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  },
}
