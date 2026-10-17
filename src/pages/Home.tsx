import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import { th } from 'date-fns/locale'
import { ArrowRight, CheckCircle2, Flame, Hourglass, Play, Timer } from 'lucide-react'
import { useAuth } from '../auth'
import { useRunning, useTasks, useTimeRange, useTimerActions } from '../data/hooks'
import type { Task } from '../lib/types'
import { dueInfo, fmtHours, greeting } from '../lib/utils'
import { useUI, RunningTimer } from '../components/Layout'
import { TaskCard } from '../components/TaskCard'
import { Empty, Spinner } from '../components/ui'

export function HomePage() {
  const { me } = useAuth()
  const tasks = useTasks()
  const { openTask, newTask } = useUI()
  const running = useRunning().data
  const timer = useTimerActions()
  const from = startOfMonth(new Date()).toISOString()
  const to = endOfMonth(new Date()).toISOString()
  const myTime = useTimeRange(from, to).data?.filter((e) => e.member_id === me.id) ?? []

  const mine = useMemo(() => (tasks.data ?? []).filter((t) => t.assignee_id === me.id), [tasks.data, me.id])
  const open = mine.filter((t) => t.status !== 'done')
  const buckets = useMemo(() => {
    const overdue: Task[] = []
    const today: Task[] = []
    const week: Task[] = []
    const later: Task[] = []
    for (const t of open) {
      const d = dueInfo(t)
      if (!d) later.push(t)
      else if (d.days < 0) overdue.push(t)
      else if (d.days <= 1) today.push(t)
      else if (d.days <= 7) week.push(t)
      else later.push(t)
    }
    const byDue = (a: Task, b: Task) => (a.due_date ?? '9').localeCompare(b.due_date ?? '9')
    return { overdue: overdue.sort(byDue), today: today.sort(byDue), week: week.sort(byDue), later: later.sort(byDue) }
  }, [open])

  const thisMonth = format(new Date(), 'yyyy-MM')
  const doneThisMonth = mine.filter((t) => t.completed_at?.startsWith(thisMonth)).length
  const minutesThisMonth = myTime.reduce((s, e) => s + (e.minutes ?? 0), 0)
  const firstName = me.full_name.split(' ')[0]

  if (tasks.isLoading)
    return (
      <div className="grid place-items-center py-24">
        <Spinner />
      </div>
    )

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <p className="text-sm font-medium text-muted">{format(new Date(), 'EEEE d MMMM', { locale: th })}</p>
        <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight md:text-4xl">
          {greeting()}, {firstName} 👋
        </h1>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={<Flame size={16} />} label="เลยกำหนด" value={buckets.overdue.length} tone={buckets.overdue.length ? 'danger' : undefined} />
        <Stat icon={<Hourglass size={16} />} label="งานค้างอยู่" value={open.length} />
        <Stat icon={<CheckCircle2 size={16} />} label="ปิดงานเดือนนี้" value={doneThisMonth} tone="ok" />
        <Stat icon={<Timer size={16} />} label="ชั่วโมงเดือนนี้" value={fmtHours(minutesThisMonth)} />
      </div>

      <div className="mb-6 md:hidden">
        <RunningTimer />
      </div>

      {!open.length ? (
        <div className="card">
          <Empty
            icon="🎉"
            title="ไม่มีงานค้าง เคลียร์หมดแล้ว!"
            hint="พักสักหน่อย หรือเพิ่มงานใหม่ได้เลย"
            action={
              <button className="btn-primary" onClick={() => newTask()}>
                สร้างงาน
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Bucket title="🔥 เลยกำหนด" tasks={buckets.overdue} onOpen={openTask} quickStart={!running} onStart={timer.start} />
          <Bucket title="⚡ วันนี้ / พรุ่งนี้" tasks={buckets.today} onOpen={openTask} quickStart={!running} onStart={timer.start} />
          <Bucket title="📅 ภายใน 7 วัน" tasks={buckets.week} onOpen={openTask} quickStart={!running} onStart={timer.start} />
          <Bucket title="🗂 อื่นๆ" tasks={buckets.later} onOpen={openTask} quickStart={!running} onStart={timer.start} limit={5} />
        </div>
      )}

      <Link to="/tasks" className="btn-ghost mt-6 text-brand">
        ดูงานทั้งหมด <ArrowRight size={16} />
      </Link>
    </div>
  )
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone?: 'danger' | 'ok' }) {
  return (
    <div className="card p-4">
      <div className={`flex items-center gap-1.5 text-xs font-semibold ${tone === 'danger' ? 'text-danger' : tone === 'ok' ? 'text-ok' : 'text-muted'}`}>
        {icon} {label}
      </div>
      <div className="mt-1.5 text-2xl font-extrabold tabular-nums">{value}</div>
    </div>
  )
}

function Bucket({
  title,
  tasks,
  onOpen,
  quickStart,
  onStart,
  limit,
}: {
  title: string
  tasks: Task[]
  onOpen: (id: string) => void
  quickStart: boolean
  onStart: (id: string) => void
  limit?: number
}) {
  if (!tasks.length) return null
  const shown = limit ? tasks.slice(0, limit) : tasks
  return (
    <section>
      <h2 className="mb-2.5 flex items-center gap-2 text-sm font-bold">
        {title} <span className="text-muted">{tasks.length}</span>
      </h2>
      <div className="flex flex-col gap-2">
        {shown.map((t) => (
          <div key={t.id} className="group relative">
            <TaskCard task={t} onOpen={() => onOpen(t.id)} showStatus />
            {quickStart && (
              <button
                onClick={() => onStart(t.id)}
                className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-xl bg-brand text-brand-ink opacity-100 shadow-pop transition md:opacity-0 md:group-hover:opacity-100"
                title="เริ่มจับเวลา"
              >
                <Play size={14} fill="currentColor" />
              </button>
            )}
          </div>
        ))}
        {limit && tasks.length > limit && (
          <Link to="/tasks" className="text-center text-xs font-semibold text-muted hover:text-ink">
            และอีก {tasks.length - limit} งาน
          </Link>
        )}
      </div>
    </section>
  )
}
