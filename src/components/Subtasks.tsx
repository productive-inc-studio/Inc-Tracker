import { useEffect, useState } from 'react'
import { Check, ListChecks, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '../auth'
import { useSubtaskActions, useSubtasksByTask } from '../data/hooks'
import { STATUSES, statusMeta } from '../lib/meta'
import type { Status, Subtask, Task } from '../lib/types'
import { cn, dueInfo } from '../lib/utils'
import { AssigneeField, DateField } from './fields'
import { MenuItem, Popover } from './ui'

/** Round status button: empty ring → coloured ring → green tick. Opens a status menu. */
export function SubtaskStatus({ status, onChange, disabled }: { status: Status; onChange: (s: Status) => void; disabled?: boolean }) {
  const ring = (
    <span
      className={cn(
        'grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition',
        status === 'done' && 'border-ok bg-ok text-white',
        status === 'in_progress' && 'border-info bg-info/15',
        status === 'review' && 'border-warn bg-warn/15',
        status === 'todo' && 'border-line',
      )}
    >
      {status === 'done' && <Check size={12} strokeWidth={3} />}
      {status === 'in_progress' && <span className="h-1.5 w-1.5 rounded-full bg-info" />}
      {status === 'review' && <span className="h-1.5 w-1.5 rounded-full bg-warn" />}
    </span>
  )
  if (disabled) return <span title={statusMeta(status).label}>{ring}</span>
  return (
    <Popover
      title="สถานะข้อย่อย"
      width={190}
      trigger={(open) => (
        <button type="button" onClick={open} className="rounded-full p-0.5 hover:bg-sunken" title={statusMeta(status).label}>
          {ring}
        </button>
      )}
    >
      {(close) =>
        STATUSES.map((s) => (
          <MenuItem key={s.id} selected={s.id === status} onClick={() => (onChange(s.id), close())}>
            <span className={cn('h-2.5 w-2.5 rounded-full', s.dot)} /> {s.label}
          </MenuItem>
        ))
      }
    </Popover>
  )
}

export function subtaskProgress(list: Subtask[] | undefined) {
  if (!list?.length) return null
  const done = list.filter((s) => s.status === 'done').length
  return { done, total: list.length, pct: Math.round((done / list.length) * 100) }
}

export function SubtaskList({ task }: { task: Task }) {
  const { me, isManager } = useAuth()
  const list = useSubtasksByTask().get(task.id) ?? []
  const actions = useSubtaskActions()
  const [title, setTitle] = useState('')
  const canEditTask = isManager || task.assignee_id === me.id || task.created_by === me.id
  const progress = subtaskProgress(list)

  const add = async () => {
    const t = title.trim()
    if (!t) return
    setTitle('')
    // new items default to the task's assignee (members may only assign themselves)
    const assignee = isManager || task.assignee_id === me.id ? task.assignee_id : null
    await actions.create(task.id, { title: t, assignee_id: assignee, position: Date.now() })
  }

  return (
    <section className="mt-7">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
          <ListChecks size={14} /> ข้อย่อย
        </h3>
        {progress && (
          <span className="text-xs font-semibold text-muted">
            เสร็จ {progress.done}/{progress.total}
          </span>
        )}
      </div>
      {progress && (
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-sunken">
          <div className="h-full rounded-full bg-ok transition-all" style={{ width: `${progress.pct}%` }} />
        </div>
      )}
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {list.map((s) => (
          <SubtaskRow key={s.id} s={s} canEditTask={canEditTask} />
        ))}
        {canEditTask && (
          <li className="flex items-center gap-2 px-3 py-2">
            <Plus size={16} className="text-muted" />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
              placeholder={list.length ? 'เพิ่มข้อย่อย…' : 'แยกงานเป็นข้อย่อย เช่น ร่าง concept, ส่งลูกค้าดู…'}
              className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
            />
            {title.trim() && (
              <button className="btn-primary h-7 px-2.5 text-xs" onClick={add}>
                เพิ่ม
              </button>
            )}
          </li>
        )}
        {!canEditTask && !list.length && <li className="px-3 py-3 text-sm text-muted">ไม่มีข้อย่อย</li>}
      </ul>
    </section>
  )
}

function SubtaskRow({ s, canEditTask }: { s: Subtask; canEditTask: boolean }) {
  const { me } = useAuth()
  const { update, remove } = useSubtaskActions()
  const [title, setTitle] = useState(s.title)
  useEffect(() => setTitle(s.title), [s.title])
  const mine = s.assignee_id === me.id
  const canStatus = canEditTask || mine
  const due = dueInfo(s)
  const done = s.status === 'done'

  return (
    <li className={cn('group flex items-center gap-2 px-3 py-1.5', mine && !canEditTask && 'bg-brand/5')}>
      <SubtaskStatus status={s.status} onChange={(status) => update(s.id, { status })} disabled={!canStatus} />
      {canEditTask ? (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== s.title && update(s.id, { title: title.trim() })}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className={cn('h-8 min-w-0 flex-1 bg-transparent text-sm outline-none', done && 'text-muted line-through')}
        />
      ) : (
        <span className={cn('min-w-0 flex-1 truncate py-1.5 text-sm', done && 'text-muted line-through')}>{s.title}</span>
      )}
      {canEditTask ? (
        <>
          <DateField
            compact
            value={s.due_date}
            onChange={(due_date) => update(s.id, { due_date })}
            placeholder="กำหนดส่งข้อย่อย"
            tone={!done ? due?.tone : undefined}
          />
          <AssigneeField compact value={s.assignee_id} onChange={(assignee_id) => update(s.id, { assignee_id })} />
          <button
            className="text-muted opacity-100 hover:text-danger md:opacity-0 md:group-hover:opacity-100"
            onClick={() => remove(s.id)}
            aria-label="ลบข้อย่อย"
          >
            <Trash2 size={14} />
          </button>
        </>
      ) : (
        due && <span className={cn('text-xs font-semibold', due.tone === 'danger' ? 'text-danger' : due.tone === 'warn' ? 'text-warn' : 'text-muted')}>{due.label}</span>
      )}
    </li>
  )
}

/** Plain list of titles typed before the task exists (new-task form). */
export function DraftSubtasks({ items, onChange }: { items: string[]; onChange: (items: string[]) => void }) {
  const [title, setTitle] = useState('')
  const add = () => {
    const t = title.trim()
    if (t) onChange([...items, t])
    setTitle('')
  }
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
        <ListChecks size={14} /> ข้อย่อย <span className="font-medium normal-case tracking-normal">(ไม่บังคับ)</span>
      </div>
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {items.map((t, i) => (
          <li key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span className="h-4 w-4 shrink-0 rounded-full border-2 border-line" />
            <span className="min-w-0 flex-1 truncate">{t}</span>
            <button type="button" className="text-muted hover:text-danger" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="เอาออก">
              <X size={14} />
            </button>
          </li>
        ))}
        <li className="flex items-center gap-2 px-3 py-1">
          <Plus size={16} className="text-muted" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
            onBlur={add}
            placeholder="พิมพ์แล้วกด Enter เพื่อเพิ่มข้อย่อย"
            className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
          />
        </li>
      </ul>
    </div>
  )
}
