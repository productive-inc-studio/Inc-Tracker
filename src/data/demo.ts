// In-memory backend for local development (`npm run dev` → ?demo). Never used in production builds.
import { addDays, format, parseISO, startOfMonth, subMonths } from 'date-fns'
import type { Api, LiveTable } from './api'
import type { Comment, Invite, Member, Project, Subtask, Task, TaskType, TimeEntry } from '../lib/types'

const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()
const iso = (d: Date) => format(d, 'yyyy-MM-dd')

const members: Member[] = [
  { id: 'u-admin', email: 'owner@inc.studio', full_name: 'Inc Owner', avatar_url: null, title: 'Creative Director', role: 'admin', created_at: now() },
  { id: 'u-lead', email: 'mild@inc.studio', full_name: 'Mild Lead', avatar_url: null, title: 'Art Director', role: 'lead', created_at: now() },
  { id: 'u-ohm', email: 'ohm@inc.studio', full_name: 'Ohm', avatar_url: null, title: 'Video Editor', role: 'member', created_at: now() },
  { id: 'u-fah', email: 'fah@inc.studio', full_name: 'Fah', avatar_url: null, title: 'Graphic Designer', role: 'member', created_at: now() },
  { id: 'u-bank', email: 'bank@inc.studio', full_name: 'Bank', avatar_url: null, title: 'Content Writer', role: 'member', created_at: now() },
  { id: 'u-new', email: 'new@gmail.com', full_name: 'New Person', avatar_url: null, title: null, role: 'pending', created_at: now() },
]
let invites: Invite[] = [{ email: 'freelance@gmail.com', role: 'member', created_at: now() }]
let projects: Project[] = [
  { id: 'p1', name: 'Summer Campaign', client: 'Sunny Drinks', color: '#FF8A3D', archived: false },
  { id: 'p2', name: 'Brand Refresh', client: 'Kopi Lab', color: '#6D4AFF', archived: false },
  { id: 'p3', name: 'TikTok Always-on', client: 'GlowUp Skin', color: '#FF5C8A', archived: false },
  { id: 'p4', name: 'Internal', client: null, color: '#9AA0AE', archived: false },
]
let types: TaskType[] = [
  ['Graphic Design', '🎨'], ['Content', '✍️'], ['Motion', '🎬'], ['Editor', '✂️'],
  ['Shooting', '📸'], ['Planning', '📋'], ['Meeting', '💬'], ['Other', '📦'],
].map(([name, emoji], i) => ({ id: `t${i + 1}`, name, emoji, sort: i + 1 }))

const TITLES: [string, string, string][] = [
  ['Key visual หน้าร้อน', 't1', 'p1'], ['คลิป Reels 15s ตัวที่ 1', 't4', 'p1'], ['แคปชัน IG สัปดาห์นี้', 't2', 'p3'],
  ['Logo exploration รอบ 2', 't1', 'p2'], ['Motion intro 5s', 't3', 'p2'], ['ถ่ายสินค้า lookbook', 't5', 'p1'],
  ['Storyboard TikTok #12', 't6', 'p3'], ['Edit vlog รีวิว', 't4', 'p3'], ['Brand guideline PDF', 't1', 'p2'],
  ['ประชุมสรุปบรีฟลูกค้า', 't7', 'p2'], ['Banner เว็บไซต์ 3 ขนาด', 't1', 'p1'], ['Script โฆษณา 30s', 't2', 'p1'],
  ['Color grade คลิปหลัก', 't4', 'p1'], ['Content calendar เดือนหน้า', 't6', 'p3'], ['Sticker LINE set', 't1', 'p4'],
  ['Thumbnail YouTube x4', 't1', 'p3'], ['Subtitle ไทย/อังกฤษ', 't4', 'p3'], ['Moodboard แคมเปญใหม่', 't6', 'p2'],
  ['Copy โปรโมชั่น 11.11', 't2', 'p3'], ['Animated logo', 't3', 'p2'], ['รีทัชรูปสินค้า 20 รูป', 't1', 'p1'],
  ['Pitch deck', 't6', 'p4'], ['Behind the scenes', 't4', 'p1'], ['Infographic', 't1', 'p3'],
]
const workers = ['u-ohm', 'u-fah', 'u-bank', 'u-lead']
const statuses: Task['status'][] = ['todo', 'in_progress', 'review', 'done', 'done', 'done']
const prios: Task['priority'][] = ['normal', 'high', 'normal', 'urgent', 'low', 'normal']

let tasks: Task[] = []
let time: TimeEntry[] = []
let comments: Comment[] = []
let subtasks: Subtask[] = []

;(function seed() {
  const today = new Date()
  const months = [subMonths(startOfMonth(today), 1), startOfMonth(today)]
  let n = 0
  for (const m of months) {
    TITLES.forEach(([title, type, project], i) => {
      if ((i + n) % 3 === 2 && m < months[1]) return
      const due = addDays(m, (i * 7 + n) % 27)
      const assignee = workers[(i + n) % workers.length]
      let status = statuses[(i * 5 + n) % statuses.length]
      if (m < months[1]) status = i % 7 === 0 ? 'in_progress' : 'done'
      const estimate = [60, 120, 240, 480, 30][i % 5]
      const t: Task = {
        id: uid(), title, description: i % 3 === 0 ? 'Brief: โทนสดใส วัยรุ่น ใช้สีแบรนด์ ส่งไฟล์ .ai + .png' : '',
        status, priority: prios[(i + n) % prios.length], project_id: project, type_id: type, assignee_id: assignee,
        created_by: 'u-lead', start_date: iso(addDays(due, -3)), due_date: iso(due), estimate_minutes: estimate,
        tracked_minutes: 0, completed_at: null, position: i, created_at: addDays(due, -5).toISOString(), updated_at: now(),
      }
      if (status === 'done') t.completed_at = addDays(due, i % 4 === 0 ? 2 : -1).toISOString()
      if (status !== 'todo') {
        const sessions = 1 + (i % 3)
        for (let s = 0; s < sessions; s++) {
          const start = addDays(due, -s - 1)
          start.setHours(10 + s * 2, 0, 0, 0)
          const minutes = Math.round((estimate / sessions) * (0.6 + ((i + s) % 5) * 0.2))
          time.push({ id: uid(), task_id: t.id, member_id: assignee, started_at: start.toISOString(),
            ended_at: new Date(start.getTime() + minutes * 60000).toISOString(), minutes, note: null })
        }
      }
      tasks.push(t)
    })
    n += 5
  }
  tasks.push({ id: uid(), title: 'ไอเดียโปรเจกต์ส่วนตัว (ไม่มีกำหนด)', description: '', status: 'todo', priority: 'low',
    project_id: null, type_id: 't8', assignee_id: 'u-fah', created_by: 'u-fah', start_date: null, due_date: null,
    estimate_minutes: null, tracked_minutes: 0, completed_at: null, position: 999, created_at: now(), updated_at: now() })
  recompute()
  // split a few tasks into subtasks, some handed to other people
  const SPLITS = [['รวบรวม reference', 'ร่าง concept 3 แบบ', 'ส่งลูกค้าเลือก', 'แก้ตาม feedback'], ['เขียน script', 'ถ่ายทำ', 'ตัดต่อ rough cut', 'ใส่ซับ + สี']]
  const thisMonth = tasks.filter((t) => t.due_date && t.due_date >= iso(startOfMonth(today))).slice(0, 8)
  thisMonth.forEach((t, i) => {
    SPLITS[i % 2].forEach((title, j) => {
      const status: Task['status'] = t.status === 'done' ? 'done' : j < (i % 3) ? 'done' : j === i % 3 && t.status !== 'todo' ? 'in_progress' : 'todo'
      subtasks.push({ id: uid(), task_id: t.id, title, status, position: j,
        assignee_id: j === 2 && i % 2 === 0 ? workers[(i + 1) % workers.length] : t.assignee_id,
        due_date: t.due_date ? iso(addDays(parseISO(t.due_date), j - 3)) : null,
        completed_at: status === 'done' ? now() : null })
    })
  })
  comments.push({ id: uid(), task_id: tasks[0].id, member_id: 'u-lead', body: 'ลูกค้าขอโทนสีสดขึ้นอีกนิดนะ 🙏', created_at: now() })
})()

function recompute() {
  for (const t of tasks) t.tracked_minutes = time.filter((e) => e.task_id === t.id && e.minutes).reduce((s, e) => s + (e.minutes ?? 0), 0)
}

const KEY = 'wt-demo-user'
let me = (() => { try { return localStorage.getItem(KEY) || 'u-admin' } catch { return 'u-admin' } })()
export function setDemoUser(id: string) {
  me = id
  try { localStorage.setItem(KEY, id) } catch { /* ignore */ }
  emit('tasks')
}
export const demoUsers = members

const me_ = () => members.find((m) => m.id === me)!
const isManager = () => ['admin', 'lead'].includes(me_().role)
const canEdit = (t: Task) => isManager() || t.assignee_id === me || t.created_by === me
const canSee = (t: Task) => canEdit(t) || subtasks.some((s) => s.task_id === t.id && s.assignee_id === me)
const listeners = new Set<(t: LiveTable) => void>()
const emit = (t: LiveTable) => setTimeout(() => listeners.forEach((l) => l(t)), 0)
const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 80))
function deny(): never { throw new Error('ไม่มีสิทธิ์ (demo)') }

export const demoApi: Api = {
  ensureMember: () => wait(me_()),
  async signOut() { setDemoUser('u-admin') },

  listMembers: () => wait(me_().role === 'pending' ? [me_()] : members),
  async updateMember(id, patch) {
    if (me_().role !== 'admin' && id !== me) deny()
    Object.assign(members.find((m) => m.id === id)!, patch)
  },
  async removeMember(id) { if (me_().role !== 'admin') deny(); members.splice(members.findIndex((m) => m.id === id), 1) },
  listInvites: () => wait(me_().role === 'admin' ? invites : []),
  async createInvite(email, role) { invites = [...invites.filter((i) => i.email !== email), { email, role, created_at: now() }] },
  async deleteInvite(email) { invites = invites.filter((i) => i.email !== email) },

  listProjects: () => wait(projects),
  async saveProject(p) {
    if (!isManager()) deny()
    const ex = p.id && projects.find((x) => x.id === p.id)
    if (ex) Object.assign(ex, p)
    else projects.push({ id: uid(), client: null, color: '#6D4AFF', archived: false, ...p })
  },
  async deleteProject(id) { projects = projects.filter((p) => p.id !== id) },
  listTypes: () => wait(types),
  async saveType(t) {
    if (!isManager()) deny()
    const ex = t.id && types.find((x) => x.id === t.id)
    if (ex) Object.assign(ex, t)
    else types.push({ id: uid(), emoji: '✨', sort: types.length + 1, ...t })
  },
  async deleteType(id) { types = types.filter((t) => t.id !== id) },

  listTasks: () => wait(me_().role === 'pending' ? [] : tasks.filter(canSee)),
  async createTask(input) {
    if (!isManager() && input.assignee_id && input.assignee_id !== me) deny()
    const t: Task = { id: uid(), description: '', status: 'todo', priority: 'normal', project_id: null, type_id: null,
      assignee_id: null, start_date: null, due_date: null, estimate_minutes: null, tracked_minutes: 0, completed_at: null,
      position: Date.now() / 1000, created_at: now(), updated_at: now(), ...input, created_by: me }
    if (t.status === 'done') t.completed_at = now()
    tasks.push(t)
    emit('tasks')
    return structuredClone(t)
  },
  async updateTask(id, patch) {
    const t = tasks.find((x) => x.id === id)
    if (!t || !canSee(t)) deny()
    if (!isManager() && patch.assignee_id && patch.assignee_id !== me) deny()
    if (patch.status && patch.status !== t.status) t.completed_at = patch.status === 'done' ? now() : null
    Object.assign(t, patch, { updated_at: now() })
    emit('tasks')
  },
  async deleteTask(id) { tasks = tasks.filter((t) => t.id !== id); emit('tasks') },

  listSubtasks: () => wait(subtasks.filter((s) => { const t = tasks.find((x) => x.id === s.task_id); return t && canSee(t) })),
  async createSubtask(taskId, input) {
    const t = tasks.find((x) => x.id === taskId)
    if (!t || !canEdit(t)) deny()
    if (!isManager() && input.assignee_id && input.assignee_id !== me) deny()
    subtasks.push({ id: uid(), task_id: taskId, status: 'todo', assignee_id: null, due_date: null, position: Date.now(), completed_at: null, ...input })
    emit('subtasks')
  },
  async updateSubtask(id, patch) {
    const s = subtasks.find((x) => x.id === id)
    const t = s && tasks.find((x) => x.id === s.task_id)
    if (!s || !t || !(canEdit(t) || s.assignee_id === me)) deny()
    if (!isManager() && patch.assignee_id && patch.assignee_id !== me && patch.assignee_id !== s.assignee_id) deny()
    if (patch.status && patch.status !== s.status) s.completed_at = patch.status === 'done' ? now() : null
    Object.assign(s, patch)
    if (patch.status && patch.status !== 'todo' && t.status === 'todo') { t.status = 'in_progress'; emit('tasks') }
    emit('subtasks')
  },
  async deleteSubtask(id) { subtasks = subtasks.filter((s) => s.id !== id); emit('subtasks') },

  listTimeEntries: (from, to) =>
    wait(time.filter((e) => e.started_at >= from && e.started_at < to && (isManager() || e.member_id === me))),
  listTaskTime: (taskId) =>
    wait(time.filter((e) => e.task_id === taskId && (isManager() || e.member_id === me)).sort((a, b) => b.started_at.localeCompare(a.started_at))),
  runningTimer: () => wait(time.find((e) => e.member_id === me && !e.ended_at) ?? null),
  async startTimer(taskId) {
    await demoApi.stopTimer()
    time.push({ id: uid(), task_id: taskId, member_id: me, started_at: now(), ended_at: null, minutes: null, note: null })
    const t = tasks.find((x) => x.id === taskId)
    if (t?.status === 'todo') t.status = 'in_progress'
    emit('time'); emit('tasks')
  },
  async stopTimer() {
    for (const e of time.filter((x) => x.member_id === me && !x.ended_at)) {
      e.ended_at = now()
      e.minutes = Math.round((Date.parse(e.ended_at) - Date.parse(e.started_at)) / 60000)
    }
    recompute(); emit('time'); emit('tasks')
  },
  async addTime(taskId, startedAt, minutes, note) {
    time.push({ id: uid(), task_id: taskId, member_id: me, started_at: startedAt,
      ended_at: new Date(Date.parse(startedAt) + minutes * 60000).toISOString(), minutes, note: note ?? null })
    recompute(); emit('time'); emit('tasks')
  },
  async deleteTime(id) { time = time.filter((e) => e.id !== id); recompute(); emit('time'); emit('tasks') },

  listComments: (taskId) => wait(comments.filter((c) => c.task_id === taskId)),
  async addComment(taskId, body) { comments.push({ id: uid(), task_id: taskId, member_id: me, body, created_at: now() }); emit('comments') },
  async deleteComment(id) { comments = comments.filter((c) => c.id !== id); emit('comments') },

  async notifyLine() { await wait(null) },

  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
}
