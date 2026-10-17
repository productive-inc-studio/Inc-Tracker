import { useMemo, useState } from 'react'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { th } from 'date-fns/locale'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Columns3, List, Plus } from 'lucide-react'
import { useAuth } from '../auth'
import { useLookups, useTasks, useTaskActions } from '../data/hooks'
import { STATUSES } from '../lib/meta'
import type { Status, Task } from '../lib/types'
import { cn } from '../lib/utils'
import { applyFilters, FilterBar, useFilters } from '../components/Filters'
import { useUI } from '../components/Layout'
import { DueLabel, TaskCard, TimeLabel } from '../components/TaskCard'
import { PriorityFlag, StatusBadge } from '../components/fields'
import { Avatar, Empty, Segmented, Spinner } from '../components/ui'

type View = 'board' | 'list' | 'calendar'

export function TasksPage() {
  const { me } = useAuth()
  const tasks = useTasks()
  const [filters, setFilters] = useFilters(`wt-filters-${me.id}`)
  const [view, setView] = useState<View>(() => {
    try {
      return (localStorage.getItem('wt-view') as View) || 'board'
    } catch {
      return 'board'
    }
  })
  const changeView = (v: View) => {
    setView(v)
    try {
      localStorage.setItem('wt-view', v)
    } catch {
      /* storage blocked */
    }
  }
  const visible = useMemo(() => applyFilters(tasks.data ?? [], filters, me.id), [tasks.data, filters, me.id])

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">งานทั้งหมด</h1>
          <p className="text-sm text-muted">{visible.length} งาน</p>
        </div>
        <Segmented
          value={view}
          onChange={changeView}
          options={[
            { id: 'board', label: <><Columns3 size={14} /> <span className="hidden sm:inline">Board</span></> },
            { id: 'list', label: <><List size={14} /> <span className="hidden sm:inline">List</span></> },
            { id: 'calendar', label: <><CalendarDays size={14} /> <span className="hidden sm:inline">ปฏิทิน</span></> },
          ]}
        />
      </div>
      <div className="mb-4">
        <FilterBar value={filters} onChange={setFilters} hideStatus={view === 'board'} />
      </div>
      {tasks.isLoading ? (
        <div className="grid place-items-center py-20">
          <Spinner />
        </div>
      ) : view === 'board' ? (
        <Board tasks={visible} />
      ) : view === 'list' ? (
        <ListView tasks={visible} />
      ) : (
        <CalendarView tasks={visible} />
      )}
    </div>
  )
}

// ─── Board ───────────────────────────────────────────────────────────────────
function Board({ tasks }: { tasks: Task[] }) {
  const { update } = useTaskActions()
  const { newTask, openTask } = useUI()
  const columns = useMemo(() => {
    const by: Record<Status, Task[]> = { todo: [], in_progress: [], review: [], done: [] }
    for (const t of tasks) by[t.status].push(t)
    for (const s of Object.keys(by) as Status[]) by[s].sort((a, b) => a.position - b.position)
    // done column: most recently finished first
    by.done.sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
    return by
  }, [tasks])

  const onDragEnd = (r: DropResult) => {
    if (!r.destination) return
    const to = r.destination.droppableId as Status
    const list = columns[to].filter((t) => t.id !== r.draggableId)
    const before = list[r.destination.index - 1]?.position
    const after = list[r.destination.index]?.position
    const position =
      before != null && after != null ? (before + after) / 2 : before != null ? before + 1 : after != null ? after - 1 : Date.now() / 1000
    const task = tasks.find((t) => t.id === r.draggableId)!
    if (task.status === to && task.position === position) return
    update(task.id, task.status === to ? { position } : { status: to, position })
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8 xl:mx-0 xl:grid xl:grid-cols-4 xl:overflow-visible xl:px-0">
        {STATUSES.map((s) => (
          <div key={s.id} className="flex w-[82vw] max-w-[340px] shrink-0 snap-start flex-col rounded-3xl bg-sunken/70 p-2 md:w-[290px] xl:w-auto xl:max-w-none">
            <div className="flex items-center gap-2 px-2 pb-2 pt-1">
              <span className={cn('h-2.5 w-2.5 rounded-full', s.dot)} />
              <span className="text-sm font-bold">{s.label}</span>
              <span className="rounded-full bg-surface px-2 text-xs font-semibold text-muted">{columns[s.id].length}</span>
              <button className="icon-btn ml-auto h-7 w-7" onClick={() => newTask({ status: s.id })} aria-label={`เพิ่มงานใน ${s.label}`}>
                <Plus size={16} />
              </button>
            </div>
            <Droppable droppableId={s.id}>
              {(drop, snap) => (
                <div
                  ref={drop.innerRef}
                  {...drop.droppableProps}
                  className={cn('flex min-h-[120px] flex-1 flex-col gap-2 rounded-2xl p-0.5 transition', snap.isDraggingOver && 'bg-brand/5')}
                >
                  {columns[s.id].map((t, i) => (
                    <Draggable key={t.id} draggableId={t.id} index={i}>
                      {(drag, ds) => (
                        <div ref={drag.innerRef} {...drag.draggableProps} {...drag.dragHandleProps}>
                          <TaskCard task={t} onOpen={() => openTask(t.id)} dragging={ds.isDragging} />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {drop.placeholder}
                  {!columns[s.id].length && !snap.isDraggingOver && (
                    <div className="grid flex-1 place-items-center rounded-2xl border-2 border-dashed border-line py-8 text-xs text-muted">
                      ลากงานมาวางที่นี่
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  )
}

// ─── List ────────────────────────────────────────────────────────────────────
type GroupBy = 'status' | 'assignee' | 'project'

function ListView({ tasks }: { tasks: Task[] }) {
  const { isManager } = useAuth()
  const { members, projects, member } = useLookups()
  const { openTask, newTask } = useUI()
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ 'status:done': true })

  const groups = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
    if (groupBy === 'status')
      return STATUSES.map((s) => ({ key: s.id, label: <StatusBadge status={s.id} />, items: sorted.filter((t) => t.status === s.id) }))
    if (groupBy === 'assignee')
      return [
        ...members.map((m) => ({
          key: m.id,
          label: (
            <span className="flex items-center gap-2 text-sm font-bold">
              <Avatar member={m} size={22} /> {m.full_name}
            </span>
          ),
          items: sorted.filter((t) => t.assignee_id === m.id),
        })),
        { key: 'none', label: <span className="text-sm font-bold text-muted">ยังไม่มอบหมาย</span>, items: sorted.filter((t) => !t.assignee_id) },
      ]
    return [
      ...projects.map((p) => ({
        key: p.id,
        label: (
          <span className="flex items-center gap-2 text-sm font-bold">
            <span className="h-3 w-3 rounded-[5px]" style={{ background: p.color }} /> {p.name}
          </span>
        ),
        items: sorted.filter((t) => t.project_id === p.id),
      })),
      { key: 'none', label: <span className="text-sm font-bold text-muted">ไม่ระบุโปรเจกต์</span>, items: sorted.filter((t) => !t.project_id) },
    ]
  }, [tasks, groupBy, members, projects])

  if (!tasks.length)
    return <Empty icon="🔍" title="ไม่พบงาน" hint="ลองล้างตัวกรอง หรือสร้างงานใหม่" action={<button className="btn-primary" onClick={() => newTask()}>สร้างงาน</button>} />

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs text-muted">
        จัดกลุ่มตาม
        <Segmented
          value={groupBy}
          onChange={setGroupBy}
          options={[
            { id: 'status', label: 'สถานะ' },
            ...(isManager ? [{ id: 'assignee' as const, label: 'คนทำ' }] : []),
            { id: 'project', label: 'โปรเจกต์' },
          ]}
        />
      </div>
      <div className="space-y-3">
        {groups
          .filter((g) => g.items.length)
          .map((g) => {
            const k = `${groupBy}:${g.key}`
            const isCollapsed = collapsed[k]
            return (
              <div key={k} className="card overflow-hidden">
                <button className="flex w-full items-center gap-2 px-4 py-3 hover:bg-sunken/50" onClick={() => setCollapsed((c) => ({ ...c, [k]: !c[k] }))}>
                  <ChevronDown size={16} className={cn('text-muted transition', isCollapsed && '-rotate-90')} />
                  {g.label}
                  <span className="text-xs font-semibold text-muted">{g.items.length}</span>
                </button>
                {!isCollapsed && (
                  <ul className="divide-y divide-line border-t border-line">
                    {g.items.map((t) => (
                      <ListRow key={t.id} task={t} onOpen={() => openTask(t.id)} assignee={member(t.assignee_id)} showStatus={groupBy !== 'status'} />
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}

function ListRow({ task, onOpen, assignee, showStatus }: { task: Task; onOpen: () => void; assignee: ReturnType<ReturnType<typeof useLookups>['member']>; showStatus: boolean }) {
  const { project, type } = useLookups()
  const { update } = useTaskActions()
  const p = project(task.project_id)
  const t = type(task.type_id)
  const done = task.status === 'done'
  return (
    <li className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-sunken/50" onClick={onOpen}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          update(task.id, { status: done ? 'todo' : 'done' })
        }}
        className={cn(
          'grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition',
          done ? 'border-ok bg-ok text-white' : 'border-line hover:border-ok',
        )}
        aria-label={done ? 'ยกเลิกเสร็จ' : 'ทำเครื่องหมายว่าเสร็จ'}
      >
        {done && <svg width="10" height="10" viewBox="0 0 12 12"><path d="M2 6.5l2.5 2.5L10 3.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>}
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn('truncate text-sm font-semibold', done && 'text-muted line-through')}>
          {t && <span className="mr-1">{t.emoji}</span>}
          {task.title}
        </div>
        <div className="mt-0.5 flex items-center gap-2 md:hidden">
          <DueLabel task={task} />
          <TimeLabel task={task} />
        </div>
      </div>
      {showStatus && <StatusBadge status={task.status} className="hidden sm:inline-flex" />}
      {p && (
        <span className="hidden max-w-[140px] items-center gap-1.5 truncate text-xs text-muted lg:inline-flex">
          <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: p.color }} />
          {p.name}
        </span>
      )}
      <span className="hidden w-24 md:block">
        <TimeLabel task={task} />
      </span>
      <span className="hidden w-20 text-right md:block">
        <DueLabel task={task} />
      </span>
      <PriorityFlag priority={task.priority} />
      <Avatar member={assignee} size={24} />
    </li>
  )
}

// ─── Calendar ────────────────────────────────────────────────────────────────
function CalendarView({ tasks }: { tasks: Task[] }) {
  const { openTask, newTask } = useUI()
  const { type } = useLookups()
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const [selected, setSelected] = useState(new Date())
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })
  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const t of tasks) if (t.due_date) m.set(t.due_date, [...(m.get(t.due_date) ?? []), t])
    return m
  }, [tasks])
  const key = (d: Date) => format(d, 'yyyy-MM-dd')
  const selectedTasks = byDay.get(key(selected)) ?? []

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button className="icon-btn" onClick={() => setMonth(subMonths(month, 1))} aria-label="เดือนก่อน">
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-[150px] text-center text-base font-bold">{format(month, 'LLLL yyyy', { locale: th })}</div>
        <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="เดือนถัดไป">
          <ChevronRight size={18} />
        </button>
        <button className="btn-outline ml-2 h-8 text-xs" onClick={() => (setMonth(startOfMonth(new Date())), setSelected(new Date()))}>
          วันนี้
        </button>
      </div>
      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line bg-sunken/60 text-center text-[11px] font-bold text-muted">
          {['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'].map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const list = byDay.get(key(d)) ?? []
            const inMonth = isSameMonth(d, month)
            return (
              <button
                key={key(d)}
                onClick={() => setSelected(d)}
                onDoubleClick={() => newTask({ due_date: key(d) })}
                className={cn(
                  'flex min-h-[58px] flex-col items-stretch border-b border-r border-line p-1 text-left align-top transition md:min-h-[112px] md:p-1.5',
                  !inMonth && 'bg-sunken/40 text-muted/60',
                  isSameDay(d, selected) && 'bg-brand/5 ring-1 ring-inset ring-brand/40',
                )}
              >
                <span
                  className={cn(
                    'mb-1 grid h-6 w-6 place-items-center self-center rounded-full text-xs font-semibold md:self-start',
                    isToday(d) && 'bg-brand text-brand-ink',
                  )}
                >
                  {format(d, 'd')}
                </span>
                {/* phones: dots; desktop: titles */}
                <div className="flex flex-wrap justify-center gap-0.5 md:hidden">
                  {list.slice(0, 4).map((t) => (
                    <span key={t.id} className={cn('h-1.5 w-1.5 rounded-full', t.status === 'done' ? 'bg-ok' : 'bg-brand')} />
                  ))}
                </div>
                <div className="hidden flex-col gap-0.5 md:flex">
                  {list.slice(0, 3).map((t) => (
                    <span
                      key={t.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        openTask(t.id)
                      }}
                      className={cn(
                        'truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
                        t.status === 'done' ? 'bg-ok/10 text-ok' : 'bg-brand/10 text-brand',
                      )}
                    >
                      {type(t.type_id)?.emoji} {t.title}
                    </span>
                  ))}
                  {list.length > 3 && <span className="px-1 text-[11px] font-semibold text-muted">+{list.length - 3} งาน</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>
      <div className="mt-4 md:hidden">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-bold">{format(selected, 'EEEE d MMMM', { locale: th })}</div>
          <button className="btn-ghost h-8 text-xs" onClick={() => newTask({ due_date: key(selected) })}>
            <Plus size={14} /> เพิ่มงานวันนี้
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {selectedTasks.length ? (
            selectedTasks.map((t) => <TaskCard key={t.id} task={t} onOpen={() => openTask(t.id)} showStatus />)
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-line py-6 text-center text-sm text-muted">ไม่มีงานส่งวันนี้</div>
          )}
        </div>
      </div>
    </div>
  )
}
