// Pushes WorkTracker cards (LINE Flex Messages) to the studio LINE group.
// The LINE token lives in function secrets (LINE_CHANNEL_TOKEN, LINE_GROUP_ID), never in the web page.
//
// Two ways in:
//  - from the app, with the caller's JWT: Row Level Security applies and only admin/lead may send
//  - from the daily pg_cron job, with an `x-cron-key` header checked against the vault secret `wt_cron_key`
// Body: { kind: 'summary', schedule?: 'morning' } | { kind: 'task', task_id } ; add dry_run: true to only validate.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'

const APP_URL = 'https://productive-inc-studio.github.io/Inc-Tracker/'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// ─── Brand ───────────────────────────────────────────────────────────────────
const C = {
  ink: '#16141F',
  muted: '#8A8698',
  line: '#ECEAF2',
  brand: '#6D4AFF',
  morning: '#F59E0B',
  danger: '#E53946',
  warn: '#E89114',
  ok: '#16A36A',
  soft: '#F5F4F9',
}
const PRIORITY: Record<string, { label: string; color: string }> = {
  urgent: { label: 'ด่วนมาก', color: C.danger },
  high: { label: 'สูง', color: C.warn },
  normal: { label: 'ปกติ', color: C.brand },
  low: { label: 'ต่ำ', color: C.muted },
}

// ─── Dates (Bangkok) ─────────────────────────────────────────────────────────
const bangkokDay = (offsetDays = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date(Date.now() + offsetDays * 86_400_000))
const daysFrom = (today: string, date: string) => Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000)
const thaiShort = (date: string) => new Date(date + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
const thaiLong = () => new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' })
function relative(today: string, date: string) {
  const d = daysFrom(today, date)
  if (d === 0) return 'วันนี้'
  if (d === 1) return 'พรุ่งนี้'
  if (d < 0) return `เลย ${-d} วัน`
  return `อีก ${d} วัน`
}

// ─── Flex building blocks ────────────────────────────────────────────────────
type Flex = Record<string, unknown>
const text = (t: string, o: Flex = {}): Flex => ({ type: 'text', text: t || ' ', wrap: true, ...o })
const sep = (): Flex => ({ type: 'separator', margin: 'lg', color: C.line })

function header(emoji: string, title: string, sub: string, color: string): Flex {
  return {
    type: 'box',
    layout: 'vertical',
    backgroundColor: color,
    paddingAll: '20px',
    paddingBottom: '18px',
    contents: [
      text(`${emoji}  ${title}`, { size: 'xxl', weight: 'bold', color: '#FFFFFF', align: 'center' }),
      text(sub, { size: 'sm', color: '#FFFFFFCC', align: 'center', margin: 'sm' }),
    ],
  }
}

function section(title: string, color: string, rows: { left: string; right?: string; rightColor?: string }[], max = 8): Flex[] {
  if (!rows.length) return []
  const shown = rows.slice(0, max)
  return [
    sep(),
    text(title, { weight: 'bold', size: 'md', color, margin: 'lg' }),
    ...shown.map(
      (r): Flex => ({
        type: 'box',
        layout: 'horizontal',
        margin: 'sm',
        spacing: 'md',
        contents: [
          text(`• ${r.left}`, { size: 'sm', color: C.ink, flex: 5 }),
          ...(r.right ? [text(r.right, { size: 'xs', color: r.rightColor ?? C.muted, flex: 2, align: 'end', gravity: 'center' })] : []),
        ],
      }),
    ),
    ...(rows.length > max ? [text(`+ อีก ${rows.length - max} งาน`, { size: 'xs', color: C.muted, margin: 'sm' })] : []),
  ]
}

function statBox(label: string, value: number, color: string): Flex {
  return {
    type: 'box',
    layout: 'vertical',
    backgroundColor: C.soft,
    cornerRadius: '12px',
    paddingAll: '10px',
    flex: 1,
    contents: [
      text(String(value), { size: 'xl', weight: 'bold', color, align: 'center' }),
      text(label, { size: 'xxs', color: C.muted, align: 'center' }),
    ],
  }
}

function button(label: string, uri: string, color = C.brand): Flex {
  return { type: 'button', style: 'primary', color, height: 'sm', action: { type: 'uri', label, uri } }
}

function bubble(head: Flex, body: Flex[], footer: Flex[]): Flex {
  return {
    type: 'bubble',
    size: 'mega',
    header: head,
    body: { type: 'box', layout: 'vertical', paddingAll: '20px', contents: body },
    footer: { type: 'box', layout: 'vertical', paddingAll: '16px', paddingTop: '0px', contents: footer },
    styles: { header: { separator: false } },
  }
}

// ─── Cards ───────────────────────────────────────────────────────────────────
type Task = {
  id: string
  title: string
  description: string
  status: string
  priority: string
  assignee_id: string | null
  project_id: string | null
  due_date: string | null
  completed_at: string | null
}

async function summaryCard(db: SupabaseClient, morning: boolean) {
  const today = bangkokDay()
  const yesterday = bangkokDay(-1)
  const [{ data: members }, { data: open }, { count: doneYesterday }, { count: doneToday }] = await Promise.all([
    db.from('wt_members').select('id, full_name'),
    db.from('wt_tasks').select('*').neq('status', 'done'),
    db.from('wt_tasks').select('id', { count: 'exact', head: true }).gte('completed_at', `${yesterday}T00:00:00+07:00`).lt('completed_at', `${today}T00:00:00+07:00`),
    db.from('wt_tasks').select('id', { count: 'exact', head: true }).gte('completed_at', `${today}T00:00:00+07:00`),
  ])
  const name = (id: string | null) => members?.find((m) => m.id === id)?.full_name?.split(' ')[0] ?? 'ยังไม่มอบหมาย'
  const tasks = (open ?? []) as Task[]
  const byDue = (a: Task, b: Task) => (a.due_date ?? '').localeCompare(b.due_date ?? '')

  const dueToday = tasks.filter((t) => t.due_date === today)
  const overdue = tasks.filter((t) => t.due_date && t.due_date < today).sort(byDue)
  const soon = tasks.filter((t) => t.due_date && t.due_date > today && daysFrom(today, t.due_date) <= 3).sort(byDue)
  const urgent = tasks.filter((t) => t.priority === 'urgent' && !dueToday.includes(t) && !overdue.includes(t) && !soon.includes(t))

  const body: Flex[] = [
    text(morning ? 'อรุณสวัสดิ์ทีม INC ☕ วันนี้มีอะไรบ้าง' : 'ภาพรวมงานของทีมตอนนี้', { size: 'md', color: C.ink, weight: 'bold' }),
    {
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      margin: 'lg',
      contents: [
        statBox('ค้างทั้งหมด', tasks.length, C.ink),
        statBox('กำลังทำ', tasks.filter((t) => t.status === 'in_progress').length, C.brand),
        statBox('รอตรวจ', tasks.filter((t) => t.status === 'review').length, C.warn),
        statBox(morning ? 'ปิดเมื่อวาน' : 'ปิดวันนี้', (morning ? doneYesterday : doneToday) ?? 0, C.ok),
      ],
    },
    ...section(`📌 ต้องส่งวันนี้ (${dueToday.length})`, C.brand, dueToday.map((t) => ({ left: t.title, right: name(t.assignee_id) }))),
    ...section(
      `🔥 เลยกำหนด (${overdue.length})`,
      C.danger,
      overdue.map((t) => ({ left: `${t.title} · ${name(t.assignee_id)}`, right: relative(today, t.due_date!), rightColor: C.danger })),
    ),
    ...section(
      `⏰ ใกล้ส่ง 3 วัน (${soon.length})`,
      C.warn,
      soon.map((t) => ({ left: `${t.title} · ${name(t.assignee_id)}`, right: `${thaiShort(t.due_date!)}`, rightColor: C.warn })),
    ),
    ...section(`⚡ งานด่วน (${urgent.length})`, C.danger, urgent.map((t) => ({ left: t.title, right: name(t.assignee_id) }))),
  ]
  if (!dueToday.length && !overdue.length && !soon.length && !urgent.length)
    body.push(sep(), text('วันนี้ไม่มีงานต้องส่งหรืองานเลยกำหนด สบาย ๆ เลย 😌', { size: 'sm', color: C.muted, margin: 'lg' }))

  const title = morning ? 'สรุปเช้า' : 'สรุปงาน'
  return {
    altText: `${morning ? '☀️' : '📊'} ${title} ${thaiLong()} · ค้าง ${tasks.length} · เลยกำหนด ${overdue.length}`,
    contents: bubble(
      header(morning ? '☀️' : '📊', title, thaiLong(), morning ? C.morning : C.brand),
      body,
      [button('เปิด WorkTracker', APP_URL, morning ? C.morning : C.brand)],
    ),
  }
}

async function taskCard(db: SupabaseClient, taskId: string) {
  const today = bangkokDay()
  const { data: t } = await db.from('wt_tasks').select('*').eq('id', taskId).maybeSingle()
  if (!t) return null
  const task = t as Task
  const [{ data: assignee }, { data: project }, { data: subs }] = await Promise.all([
    task.assignee_id ? db.from('wt_members').select('full_name').eq('id', task.assignee_id).maybeSingle() : Promise.resolve({ data: null }),
    task.project_id ? db.from('wt_projects').select('name').eq('id', task.project_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from('wt_subtasks').select('status').eq('task_id', task.id),
  ])
  const p = PRIORITY[task.priority] ?? PRIORITY.normal
  const urgent = task.priority === 'urgent'
  const row = (label: string, value: string, color = C.ink): Flex => ({
    type: 'box',
    layout: 'horizontal',
    margin: 'md',
    contents: [text(label, { size: 'sm', color: C.muted, flex: 2 }), text(value, { size: 'sm', color, weight: 'bold', flex: 4 })],
  })
  const dueColor = task.due_date && task.due_date < today ? C.danger : task.due_date && daysFrom(today, task.due_date) <= 1 ? C.warn : C.ink
  const done = subs?.filter((s) => s.status === 'done').length ?? 0

  const body: Flex[] = [
    ...(project?.name ? [text(project.name, { size: 'xs', color: C.muted, weight: 'bold' })] : []),
    text(task.title, { size: 'xl', weight: 'bold', color: C.ink, margin: project?.name ? 'xs' : 'none' }),
    sep(),
    row('👤 ผู้รับผิดชอบ', assignee?.full_name ?? 'ยังไม่มอบหมาย'),
    row('📅 กำหนดส่ง', task.due_date ? `${thaiShort(task.due_date)} (${relative(today, task.due_date)})` : 'ไม่ระบุ', dueColor),
    row('⚡ ความสำคัญ', p.label, p.color),
    ...(subs?.length ? [row('☑️ ข้อย่อย', `เสร็จ ${done}/${subs.length}`)] : []),
    ...(task.description
      ? [
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            backgroundColor: C.soft,
            cornerRadius: '12px',
            paddingAll: '12px',
            contents: [text(task.description.slice(0, 280), { size: 'sm', color: C.ink })],
          },
        ]
      : []),
  ]
  const color = urgent ? C.danger : C.brand
  return {
    altText: `${urgent ? '🔥 งานด่วน' : '📣 แจ้งงาน'}: ${task.title}`,
    contents: bubble(header(urgent ? '🔥' : '📣', urgent ? 'งานด่วน!' : 'แจ้งเตือนงาน', thaiLong(), color), body, [
      button('เปิดงาน', `${APP_URL}#/tasks?task=${task.id}`, color),
    ]),
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const token = Deno.env.get('LINE_CHANNEL_TOKEN')
  const group = Deno.env.get('LINE_GROUP_ID')
  if (!token || !group) return json({ error: 'ยังไม่ได้ตั้งค่า LINE (LINE_CHANNEL_TOKEN / LINE_GROUP_ID)' }, 500)

  let payload: { kind?: string; task_id?: string; schedule?: string; dry_run?: boolean }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'invalid body' }, 400)
  }

  const url = Deno.env.get('SUPABASE_URL')!
  let db: SupabaseClient
  const cronKey = req.headers.get('x-cron-key')
  if (cronKey) {
    // scheduled run: verify the key against the vault, then read everything with the service role
    db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: ok } = await db.rpc('wt_cron_key_valid', { p_key: cronKey })
    if (ok !== true) return json({ error: 'invalid cron key' }, 403)
  } else {
    db = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: role } = await db.rpc('wt_my_role')
    if (role !== 'admin' && role !== 'lead') return json({ error: 'เฉพาะ Admin / Lead ที่ส่งแจ้งเตือน LINE ได้' }, 403)
  }

  let message: { altText: string; contents: Flex } | null
  if (payload.kind === 'summary') message = await summaryCard(db, payload.schedule === 'morning')
  else if (payload.kind === 'task' && payload.task_id) message = await taskCard(db, payload.task_id)
  else return json({ error: 'unknown kind' }, 400)
  if (!message) return json({ error: 'ไม่พบงาน' }, 404)

  const res = await fetch(`https://api.line.me/v2/bot/message/${payload.dry_run ? 'validate/push' : 'push'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(
      payload.dry_run
        ? { messages: [{ type: 'flex', ...message }] }
        : { to: group, messages: [{ type: 'flex', ...message }] },
    ),
  })
  if (!res.ok) return json({ error: `LINE ตอบกลับ ${res.status}: ${await res.text()}` }, 502)
  return json({ ok: true, dry_run: !!payload.dry_run })
})
