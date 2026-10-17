import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addDays, differenceInCalendarDays, endOfMonth, format, isToday, parseISO, startOfMonth } from 'date-fns'
import { th } from 'date-fns/locale'
import { ArrowRight, CalendarClock, CheckCircle2, Flame, Play, Timer } from 'lucide-react'
import { useAuth } from '../auth'
import { useLookups, useRunning, useSubtaskActions, useSubtasks, useTasks, useTimeRange, useTimerActions } from '../data/hooks'
import type { Subtask, Task } from '../lib/types'
import { cn, fmtHours, greeting } from '../lib/utils'
import { RunningTimer, useUI } from '../components/Layout'
import { DateTile, MiniCalendar } from '../components/CalendarWidget'
import { SubtaskStatus } from '../components/Subtasks'
import { TaskCard } from '../components/TaskCard'
import { Empty, Spinner } from '../components/ui'

const key = (d: Date) => format(d, 'yyyy-MM-dd')

/** A task belongs to a day if it is due that day or the day falls inside its start → due range. */
function onDay(t: Task, day: string) {
  if (t.due_date === day) return true
  return !!(t.start_date && t.due_date && t.start_date <= day && day <= t.due_date)
}

export function HomePage() {
  const { me } = useAuth()
  const tasks = useTasks()
  const subtasks = useSubtasks().data ?? []
  const { task: taskById } = useTaskIndex(tasks.data)
  const { openTask, newTask } = useUI()
  const running = useRunning().data
  const timer = useTimerActions()
  const [selected, setSelected] = useState(new Date())
  const day = key(selected)
  const today = key(new Date())
  const viewingToday = day === today

  const monthFrom = startOfMonth(new Date()).toISOString()
  const monthTo = endOfMonth(new Date()).toISOString()
  const myMinutes = (useTimeRange(monthFrom, monthTo).data ?? []).filter((e) => e.member_id === me.id).reduce((s, e) => s + (e.minutes ?? 0), 0)

  const mine = useMemo(() => (tasks.data ?? []).filter((t) => t.assignee_id === me.id), [tasks.data, me.id])
  // subtasks handed to me on tasks owned by someone else (my own tasks already show their subtasks)
  const mySubs = useMemo(
    () => subtasks.filter((s) => s.assignee_id === me.id && taskById(s.task_id)?.assignee_id !== me.id),
    [subtasks, me.id, taskById],
  )

  const view = useMemo(() => {
    const open = mine.filter((t) => t.status !== 'done')
    const overdue = viewingToday ? open.filter((t) => t.due_date && t.due_date < today) : []
    const dayTasks = open.filter(
      (t) => !overdue.includes(t) && (onDay(t, day) || (viewingToday && t.status === 'in_progress')),
    )
    const doneToday = viewingToday ? mine.filter((t) => t.completed_at && isToday(parseISO(t.completed_at))) : []
    const subsDue = mySubs.filter((s) => s.status !== 'done' && s.due_date && (s.due_date === day || (viewingToday && s.due_date < today)))
    const subsDone = viewingToday ? mySubs.filter((s) => s.completed_at && isToday(parseISO(s.completed_at))) : []

    const horizon = key(addDays(new Date(), 7))
    const upcoming = [
      ...open.filter((t) => t.due_date && t.due_date > today && t.due_date <= horizon && !(viewingToday && dayTasks.includes(t))).map((t) => ({ kind: 'task' as const, date: t.due_date!, t })),
      ...mySubs
        .filter((s) => s.status !== 'done' && s.due_date && s.due_date > today && s.due_date <= horizon)
        .map((s) => ({ kind: 'sub' as const, date: s.due_date!, s })),
    ].sort((a, b) => a.date.localeCompare(b.date))

    const total = dayTasks.length + overdue.length + subsDue.length + doneToday.length + subsDone.length
    const done = doneToday.length + subsDone.length
    return { overdue, dayTasks, doneToday, subsDue, subsDone, upcoming, pct: total ? Math.round((done / total) * 100) : null, done, total }
  }, [mine, mySubs, day, today, viewingToday])

  const marks = useMemo(() => {
    const m = new Map<string, 'due' | 'overdue' | 'done'>()
    const items: { due: string | null; status: string }[] = [...mine.map((t) => ({ due: t.due_date, status: t.status })), ...mySubs.map((s) => ({ due: s.due_date, status: s.status }))]
    for (const it of items) {
      if (!it.due) continue
      const kind = it.status === 'done' ? 'done' : it.due < today ? 'overdue' : 'due'
      const prev = m.get(it.due)
      if (!prev || kind === 'overdue' || (kind === 'due' && prev === 'done')) m.set(it.due, kind)
    }
    return m
  }, [mine, mySubs, today])

  const monthKey = format(new Date(), 'yyyy-MM')
  const doneThisMonth = mine.filter((t) => t.completed_at?.startsWith(monthKey)).length
  const overdueCount = mine.filter((t) => t.status !== 'done' && t.due_date && t.due_date < today).length

  const Stats = () => (
    <>
      <div className="card p-5">
        <div className="text-[56px] font-extrabold leading-none tracking-tighter tabular-nums">
          {view.pct == null ? '—' : `${view.pct}%`}
        </div>
        <div className="mt-1 text-sm text-muted">
          {view.pct == null ? 'ยังไม่มีงานที่ต้องทำวันนี้' : `ความคืบหน้า${viewingToday ? 'วันนี้' : 'วันที่เลือก'} · เสร็จ ${view.done}/${view.total}`}
        </div>
      </div>
      <div className="rounded-2xl bg-pop p-4 text-[#1a1a12]">
        <div className="text-sm font-bold">เดือนนี้ของฉัน</div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <MiniStat icon={<CheckCircle2 size={14} />} value={doneThisMonth} label="ปิดงาน" />
          <MiniStat icon={<Timer size={14} />} value={fmtHours(myMinutes).replace(' ชม.', '')} label="ชั่วโมง" />
          <MiniStat icon={<Flame size={14} />} value={overdueCount} label="เลยกำหนด" />
        </div>
      </div>
    </>
  )

  if (tasks.isLoading)
    return (
      <div className="grid place-items-center py-24">
        <Spinner />
      </div>
    )

  const dayLabel = viewingToday ? 'งานวันนี้' : `งานวัน${format(selected, 'EEEE d MMM', { locale: th }).replace(/^วัน/, '')}`
  const empty = !view.overdue.length && !view.dayTasks.length && !view.subsDue.length && !view.doneToday.length && !view.subsDone.length

  return (
    <div className="relative mx-auto max-w-6xl">
      <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-[120%] -translate-x-1/2 rounded-full bg-gradient-to-b from-brand/15 via-info/5 to-transparent blur-2xl" />

      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted">{format(new Date(), 'EEEE d MMMM yyyy', { locale: th })}</p>
          <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight md:text-4xl">
            {greeting()}, {me.full_name.split(' ')[0]} 👋
          </h1>
        </div>
        <button className="btn-primary hidden md:inline-flex" onClick={() => newTask({ due_date: day })}>
          + งานใหม่{viewingToday ? 'วันนี้' : ` ${format(selected, 'd MMM', { locale: th })}`}
        </button>
      </header>

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)_300px]">
        {/* ── Left: widgets ─────────────────────────────────────────── */}
        <aside className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <DateTile />
            <MiniCalendar selected={selected} onSelect={setSelected} marks={marks} />
          </div>
          <div className="hidden flex-col gap-4 lg:flex">
            <Stats />
          </div>
        </aside>

        {/* ── Center: the selected day ──────────────────────────────── */}
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">{dayLabel}</h2>
            {!viewingToday && (
              <button className="btn-ghost h-8 text-xs" onClick={() => setSelected(new Date())}>
                กลับมาวันนี้
              </button>
            )}
          </div>
          <div className="mb-4 lg:hidden">
            <RunningTimer />
          </div>

          {empty ? (
            <div className="card">
              <Empty
                icon={viewingToday ? '🎉' : '🗓️'}
                title={viewingToday ? 'วันนี้ไม่มีงานค้าง' : 'ไม่มีงานในวันนี้'}
                hint="เพิ่มงานใหม่ หรือดูงานที่ใกล้ส่งทางขวา"
                action={
                  <button className="btn-primary" onClick={() => newTask({ due_date: day })}>
                    สร้างงาน
                  </button>
                }
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {view.overdue.length > 0 && <Label tone="danger">🔥 เลยกำหนด {view.overdue.length}</Label>}
              {view.overdue.map((t) => (
                <QuickCard key={t.id} task={t} onOpen={openTask} canStart={!running} onStart={timer.start} />
              ))}
              {view.dayTasks.length > 0 && view.overdue.length > 0 && <Label>ต้องทำ{viewingToday ? 'วันนี้' : ''}</Label>}
              {view.dayTasks.map((t) => (
                <QuickCard key={t.id} task={t} onOpen={openTask} canStart={!running} onStart={timer.start} />
              ))}
              {view.subsDue.length > 0 && (
                <>
                  <Label>ข้อย่อยที่ได้รับมอบหมาย</Label>
                  <SubtaskChecklist items={view.subsDue} />
                </>
              )}
              {(view.doneToday.length > 0 || view.subsDone.length > 0) && (
                <>
                  <Label tone="ok">✓ เสร็จแล้ววันนี้</Label>
                  {view.doneToday.map((t) => (
                    <TaskCard key={t.id} task={t} onOpen={() => openTask(t.id)} />
                  ))}
                  {view.subsDone.length > 0 && <SubtaskChecklist items={view.subsDone} />}
                </>
              )}
            </div>
          )}
        </section>

        {/* ── Right: upcoming ───────────────────────────────────────── */}
        <aside className="flex flex-col gap-4">
          <div className="hidden lg:block">
            <RunningTimer />
          </div>
          <div className="card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold">
              <CalendarClock size={16} className="text-brand" /> ใกล้ถึงกำหนดส่ง
              <span className="text-xs font-semibold text-muted">7 วัน</span>
            </h2>
            {view.upcoming.length ? (
              <Upcoming items={view.upcoming} />
            ) : (
              <p className="py-4 text-center text-sm text-muted">ไม่มีงานต้องส่งใน 7 วันข้างหน้า 🙌</p>
            )}
          </div>
          <Link to="/tasks" className="btn-ghost justify-start text-brand">
            ดูงานทั้งหมด <ArrowRight size={16} />
          </Link>
        </aside>
        <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
          <Stats />
        </div>
      </div>
    </div>
  )
}

function useTaskIndex(tasks: Task[] | undefined) {
  return useMemo(() => {
    const m = new Map((tasks ?? []).map((t) => [t.id, t]))
    return { task: (id: string) => m.get(id) }
  }, [tasks])
}

function Label({ children, tone }: { children: React.ReactNode; tone?: 'danger' | 'ok' }) {
  return (
    <div className={cn('mt-2 text-xs font-bold uppercase tracking-wider first:mt-0', tone === 'danger' ? 'text-danger' : tone === 'ok' ? 'text-ok' : 'text-muted')}>
      {children}
    </div>
  )
}

function MiniStat({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div>
      <div className="text-2xl font-extrabold leading-none tabular-nums">{value}</div>
      <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold opacity-70">
        {icon} {label}
      </div>
    </div>
  )
}

function QuickCard({ task, onOpen, canStart, onStart }: { task: Task; onOpen: (id: string) => void; canStart: boolean; onStart: (id: string) => void }) {
  return (
    <div className="group relative">
      <TaskCard task={task} onOpen={() => onOpen(task.id)} showStatus />
      {canStart && (
        <button
          onClick={() => onStart(task.id)}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-xl bg-brand text-brand-ink shadow-pop transition md:opacity-0 md:group-hover:opacity-100"
          title="เริ่มจับเวลา"
        >
          <Play size={14} fill="currentColor" />
        </button>
      )}
    </div>
  )
}

/** Subtasks I own on other people's tasks: tick them off right here. */
function SubtaskChecklist({ items }: { items: Subtask[] }) {
  const { update } = useSubtaskActions()
  const { openTask } = useUI()
  const tasks = useTasks().data
  return (
    <ul className="card divide-y divide-line">
      {items.map((s) => {
        const parent = tasks?.find((t) => t.id === s.task_id)
        return (
          <li key={s.id} className="flex items-center gap-2.5 px-3 py-2">
            <SubtaskStatus status={s.status} onChange={(status) => update(s.id, { status })} />
            <button className="min-w-0 flex-1 text-left" onClick={() => openTask(s.task_id)}>
              <span className={cn('block truncate text-sm font-semibold', s.status === 'done' && 'text-muted line-through')}>{s.title}</span>
              {parent && <span className="block truncate text-xs text-muted">ใน: {parent.title}</span>}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

type UpcomingItem = { kind: 'task'; date: string; t: Task } | { kind: 'sub'; date: string; s: Subtask }

function Upcoming({ items }: { items: UpcomingItem[] }) {
  const { openTask } = useUI()
  const { type } = useLookups()
  const tasks = useTasks().data
  const groups = new Map<string, UpcomingItem[]>()
  for (const it of items) groups.set(it.date, [...(groups.get(it.date) ?? []), it])
  return (
    <div className="space-y-3">
      {[...groups.entries()].map(([date, list]) => {
        const d = parseISO(date)
        const diff = differenceInCalendarDays(d, new Date())
        return (
          <div key={date} className="flex gap-3">
            <div className="w-11 shrink-0 text-center">
              <div className={cn('text-[10px] font-bold uppercase', diff === 1 ? 'text-warn' : 'text-muted')}>
                {diff === 1 ? 'พรุ่งนี้' : format(d, 'EEE', { locale: th })}
              </div>
              <div className="text-xl font-extrabold leading-tight tabular-nums">{format(d, 'd')}</div>
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5 border-l border-line pl-3">
              {list.map((it) => {
                const title = it.kind === 'task' ? it.t.title : it.s.title
                const taskId = it.kind === 'task' ? it.t.id : it.s.task_id
                const sub = it.kind === 'sub' ? tasks?.find((t) => t.id === it.s.task_id)?.title : null
                const emoji = it.kind === 'task' ? type(it.t.type_id)?.emoji : '☑️'
                return (
                  <li key={it.kind === 'task' ? it.t.id : it.s.id}>
                    <button onClick={() => openTask(taskId)} className="block w-full rounded-lg px-1.5 py-1 text-left hover:bg-sunken">
                      <span className="block truncate text-sm font-semibold">
                        {emoji} {title}
                      </span>
                      {sub && <span className="block truncate text-xs text-muted">ข้อย่อยใน: {sub}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
