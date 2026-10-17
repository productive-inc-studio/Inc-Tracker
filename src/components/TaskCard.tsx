import { Clock, ListChecks } from 'lucide-react'
import { useLookups, useRunning, useSubtasks } from '../data/hooks'
import type { Task } from '../lib/types'
import { cn, dueInfo, fmtMinutes } from '../lib/utils'
import { PriorityFlag, StatusBadge } from './fields'
import { Avatar } from './ui'

export function DueLabel({ task }: { task: Task }) {
  const d = dueInfo(task)
  if (!d) return null
  return (
    <span
      className={cn(
        'whitespace-nowrap text-xs font-semibold',
        task.status === 'done' ? 'text-muted' : d.tone === 'danger' ? 'text-danger' : d.tone === 'warn' ? 'text-warn' : 'text-muted',
      )}
    >
      {d.label}
    </span>
  )
}

export function SubtaskLabel({ task }: { task: Task }) {
  const list = useSubtasks().data?.filter((s) => s.task_id === task.id)
  if (!list?.length) return null
  const done = list.filter((s) => s.status === 'done').length
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-xs tabular-nums', done === list.length ? 'text-ok' : 'text-muted')} title="ข้อย่อยที่เสร็จ">
      <ListChecks size={13} />
      {done}/{list.length}
    </span>
  )
}

export function TimeLabel({ task }: { task: Task }) {
  if (!task.tracked_minutes && !task.estimate_minutes) return null
  const over = task.estimate_minutes != null && task.tracked_minutes > task.estimate_minutes
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-xs tabular-nums', over ? 'font-semibold text-warn' : 'text-muted')}>
      <Clock size={12} />
      {task.tracked_minutes ? fmtMinutes(task.tracked_minutes) : '~'}
      {task.estimate_minutes ? <span className={task.tracked_minutes ? 'opacity-70' : ''}>{task.tracked_minutes ? '/' : ''}{fmtMinutes(task.estimate_minutes)}</span> : null}
    </span>
  )
}

export function TaskCard({ task, onOpen, showStatus, dragging }: { task: Task; onOpen: () => void; showStatus?: boolean; dragging?: boolean }) {
  const { member, project, type } = useLookups()
  const running = useRunning().data
  const p = project(task.project_id)
  const t = type(task.type_id)
  const due = dueInfo(task)
  const isRunning = running?.task_id === task.id

  return (
    <div
      onClick={onOpen}
      className={cn(
        'group cursor-pointer rounded-2xl border bg-surface p-3 shadow-card transition hover:border-brand/40',
        dragging ? 'rotate-[1.5deg] border-brand shadow-pop' : 'border-line',
        due?.overdue && 'border-l-[3px] border-l-danger',
        isRunning && 'ring-2 ring-brand',
      )}
    >
      {p && (
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted">
          <span className="h-2 w-2 rounded-[3px]" style={{ background: p.color }} />
          <span className="truncate">{p.name}</span>
        </div>
      )}
      <div className={cn('text-[13.5px] font-semibold leading-snug', task.status === 'done' && 'text-muted')}>
        {t && <span className="mr-1">{t.emoji}</span>}
        {task.title}
      </div>
      <div className="mt-2.5 flex items-center gap-x-2 gap-y-1">
        {showStatus && <StatusBadge status={task.status} />}
        <PriorityFlag priority={task.priority} />
        <DueLabel task={task} />
        <SubtaskLabel task={task} />
        <TimeLabel task={task} />
        {isRunning && <span className="h-2 w-2 animate-pulse rounded-full bg-brand" title="กำลังจับเวลา" />}
        <Avatar member={member(task.assignee_id)} size={24} className="ml-auto" />
      </div>
    </div>
  )
}

