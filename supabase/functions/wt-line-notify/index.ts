// Pushes WorkTracker messages to the studio LINE group.
// The LINE token lives in function secrets (LINE_CHANNEL_TOKEN, LINE_GROUP_ID), never in the web page.
// Runs with the caller's JWT so Row Level Security applies; only admin/lead may send.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const APP_URL = 'https://productive-inc-studio.github.io/Inc-Tracker/'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const PRIORITY: Record<string, string> = { urgent: '🔴 ด่วนมาก', high: '🟠 สูง', normal: '🔵 ปกติ', low: '⚪ ต่ำ' }

function bangkokToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
}
function daysFrom(today: string, date: string) {
  return Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000)
}
function thaiDate(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const token = Deno.env.get('LINE_CHANNEL_TOKEN')
  const group = Deno.env.get('LINE_GROUP_ID')
  if (!token || !group) return json({ error: 'ยังไม่ได้ตั้งค่า LINE (LINE_CHANNEL_TOKEN / LINE_GROUP_ID)' }, 500)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: role } = await supabase.rpc('wt_my_role')
  if (role !== 'admin' && role !== 'lead') return json({ error: 'เฉพาะ Admin / Lead ที่ส่งแจ้งเตือน LINE ได้' }, 403)

  let payload: { kind?: string; task_id?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'invalid body' }, 400)
  }

  const { data: members } = await supabase.from('wt_members').select('id, full_name')
  const name = (id: string | null) => members?.find((m) => m.id === id)?.full_name ?? 'ยังไม่มอบหมาย'
  const today = bangkokToday()
  let text: string

  if (payload.kind === 'task' && payload.task_id) {
    const { data: t } = await supabase.from('wt_tasks').select('*').eq('id', payload.task_id).maybeSingle()
    if (!t) return json({ error: 'ไม่พบงาน' }, 404)
    const due = t.due_date ? `${thaiDate(t.due_date)} (${daysFrom(today, t.due_date) < 0 ? `เลย ${-daysFrom(today, t.due_date)} วัน` : daysFrom(today, t.due_date) === 0 ? 'วันนี้' : `อีก ${daysFrom(today, t.due_date)} วัน`})` : 'ไม่ระบุ'
    text = [
      `📣 ${t.priority === 'urgent' ? 'งานด่วน!' : 'แจ้งเตือนงาน'}`,
      ``,
      `📌 ${t.title}`,
      `👤 ${name(t.assignee_id)}`,
      `📅 กำหนดส่ง: ${due}`,
      `⚡ ความสำคัญ: ${PRIORITY[t.priority] ?? t.priority}`,
      t.description ? `📝 ${t.description.slice(0, 300)}` : '',
      ``,
      `🔗 ${APP_URL}#/tasks?task=${t.id}`,
    ]
      .filter((l, i, a) => l !== '' || a[i - 1] !== '')
      .join('\n')
  } else if (payload.kind === 'summary') {
    const { data: tasks } = await supabase.from('wt_tasks').select('*').neq('status', 'done')
    const open = tasks ?? []
    const overdue = open.filter((t) => t.due_date && t.due_date < today)
    const soon = open.filter((t) => t.due_date && t.due_date >= today && daysFrom(today, t.due_date) <= 2)
    const urgent = open.filter((t) => t.priority === 'urgent' && !overdue.includes(t) && !soon.includes(t))
    const { count: doneToday } = await supabase
      .from('wt_tasks')
      .select('id', { count: 'exact', head: true })
      .gte('completed_at', `${today}T00:00:00+07:00`)
    const line = (t: { title: string; assignee_id: string | null; due_date: string | null }) =>
      `• ${t.title} — ${name(t.assignee_id)}${t.due_date ? ` (${thaiDate(t.due_date)})` : ''}`

    const parts = [`📊 สรุปงานประจำวัน ${new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'long' })}`, '']
    if (overdue.length) parts.push(`🔥 เลยกำหนด ${overdue.length} งาน`, ...overdue.slice(0, 10).map(line), '')
    if (soon.length) parts.push(`⏰ ส่งภายใน 2 วัน ${soon.length} งาน`, ...soon.slice(0, 10).map(line), '')
    if (urgent.length) parts.push(`🔴 งานด่วน ${urgent.length} งาน`, ...urgent.slice(0, 10).map(line), '')
    if (!overdue.length && !soon.length && !urgent.length) parts.push('✅ ไม่มีงานเลยกำหนดหรืองานด่วน', '')
    parts.push(`✔️ ปิดงานวันนี้ ${doneToday ?? 0} งาน · ค้างทั้งหมด ${open.length} งาน`, '', `🔗 ${APP_URL}`)
    text = parts.join('\n')
  } else {
    return json({ error: 'unknown kind' }, 400)
  }

  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: group, messages: [{ type: 'text', text: text.slice(0, 4900) }] }),
  })
  if (!res.ok) return json({ error: `LINE ตอบกลับ ${res.status}: ${await res.text()}` }, 502)
  return json({ ok: true })
})
