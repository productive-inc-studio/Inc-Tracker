import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ArrowLeft, Megaphone, Play, Plus, Send, Square, Trash2, X } from 'lucide-react'
import { useAuth } from '../auth'
import { api, keys, useComments, useLookups, useRunning, useTasks, useTaskActions, useTaskTime, useTimerActions } from '../data/hooks'
import type { Task } from '../lib/types'
import { cn, dueInfo, fmtClock, fmtDate, fmtMinutes } from '../lib/utils'
import { useElapsed } from './Layout'
import { AssigneeField, DateField, EstimateField, PriorityField, ProjectField, StatusField, TypeField } from './fields'
import { Avatar, Spinner } from './ui'
import { SubtaskList } from './Subtasks'
import { useToast } from './Toast'

export function TaskDrawer({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const tasks = useTasks()
  const task = tasks.data?.find((t) => t.id === taskId)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/30 animate-fade-in" onClick={onClose}>
      <div
        className="flex h-full w-full flex-col bg-surface shadow-pop animate-slide-in md:max-w-[560px] md:border-l md:border-line"
        onClick={(e) => e.stopPropagation()}
      >
        {task ? (
          <Body task={task} onClose={onClose} />
        ) : (
          <div className="grid flex-1 place-items-center">
            {tasks.isLoading ? (
              <Spinner />
            ) : (
              <div className="text-center text-muted">
                ไม่พบงานนี้ หรือคุณไม่มีสิทธิ์ดู
                <div>
                  <button className="btn-outline mt-3" onClick={onClose}>
                    ปิด
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

function Body({ task, onClose }: { task: Task; onClose: () => void }) {
  const { me, isManager } = useAuth()
  const { member } = useLookups()
  const { update, remove } = useTaskActions()
  const toast = useToast()
  const [title, setTitle] = useState(task.title)
  const [desc, setDesc] = useState(task.description)
  useEffect(() => setTitle(task.title), [task.title])
  useEffect(() => setDesc(task.description), [task.description])

  const due = dueInfo(task)
  const canDelete = isManager || task.created_by === me.id
  // someone who only owns a subtask can see the task but not edit it
  const canEdit = isManager || task.assignee_id === me.id || task.created_by === me.id
  const set = (patch: Partial<Task>) => update(task.id, patch)
  const creator = member(task.created_by)

  const notify = useMutation({
    mutationFn: () => api.notifyLine({ kind: 'task', task_id: task.id }),
    onSuccess: () => toast('ส่งแจ้งเตือนเข้า LINE แล้ว'),
    onError: (e: Error) => toast(e.message, 'error'),
  })

  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-1 border-b border-line px-3">
        <button className="icon-btn md:hidden" onClick={onClose} aria-label="กลับ">
          <ArrowLeft size={19} />
        </button>
        <div className={cn(!canEdit && 'pointer-events-none')}>
          <StatusField value={task.status} onChange={(status) => set({ status })} />
        </div>
        <div className="ml-auto flex items-center">
          {isManager && (
            <button className="icon-btn" title="แจ้งเข้า LINE กลุ่ม" onClick={() => notify.mutate()} disabled={notify.isPending}>
              {notify.isPending ? <Spinner /> : <Megaphone size={17} />}
            </button>
          )}
          {canDelete && (
            <button
              className="icon-btn hover:text-danger"
              title="ลบงาน"
              onClick={() => {
                if (confirm(`ลบงาน "${task.title}" ? ลบแล้วกู้คืนไม่ได้`)) {
                  remove(task.id)
                  onClose()
                }
              }}
            >
              <Trash2 size={17} />
            </button>
          )}
          <button className="icon-btn hidden md:inline-flex" onClick={onClose} aria-label="ปิด">
            <X size={19} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-10 pt-4">
        <textarea
          rows={1}
          readOnly={!canEdit}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== task.title && set({ title: title.trim() })}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
          className="w-full resize-none bg-transparent text-xl font-extrabold leading-snug outline-none [field-sizing:content]"
        />
        <div className="mt-1 text-xs text-muted">
          สร้างโดย {creator?.full_name ?? '—'} · {fmtDate(task.created_at, 'd MMM yy')}
          {task.completed_at && <> · เสร็จ {fmtDate(task.completed_at, 'd MMM yy')}</>}
        </div>

        {!canEdit && (
          <div className="mt-3 rounded-xl bg-brand/10 px-3 py-2 text-xs font-medium text-brand">
            คุณได้รับมอบหมายข้อย่อยในงานนี้ อัปเดตสถานะข้อย่อยของคุณได้ด้านล่าง
          </div>
        )}
        <div className={cn('mt-5 grid grid-cols-[96px_1fr] items-center gap-x-3 gap-y-2.5 text-sm', !canEdit && 'pointer-events-none')}>
          <span className="text-muted">ผู้รับผิดชอบ</span>
          <div>
            <AssigneeField value={task.assignee_id} onChange={(assignee_id) => set({ assignee_id })} />
          </div>
          <span className="text-muted">กำหนดส่ง</span>
          <div className="flex flex-wrap items-center gap-2">
            <DateField value={task.due_date} onChange={(due_date) => set({ due_date })} placeholder="กำหนดส่ง" tone={due?.tone} />
            {due && task.status !== 'done' && (
              <span className={cn('text-xs font-semibold', due.tone === 'danger' ? 'text-danger' : due.tone === 'warn' ? 'text-warn' : 'text-muted')}>
                {due.label}
              </span>
            )}
          </div>
          <span className="text-muted">เริ่มงาน</span>
          <div>
            <DateField value={task.start_date} onChange={(start_date) => set({ start_date })} placeholder="วันเริ่ม" />
          </div>
          <span className="text-muted">ความสำคัญ</span>
          <div>
            <PriorityField value={task.priority} onChange={(priority) => set({ priority })} />
          </div>
          <span className="text-muted">โปรเจกต์</span>
          <div>
            <ProjectField value={task.project_id} onChange={(project_id) => set({ project_id })} />
          </div>
          <span className="text-muted">ประเภท</span>
          <div>
            <TypeField value={task.type_id} onChange={(type_id) => set({ type_id })} />
          </div>
        </div>

        <Section title="Brief / รายละเอียด">
          <textarea
            readOnly={!canEdit}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onBlur={() => desc !== task.description && set({ description: desc })}
            placeholder="เพิ่มรายละเอียด ลิงก์ไฟล์ หรือ feedback จากลูกค้า…"
            className="min-h-[110px] w-full resize-y rounded-xl bg-sunken p-3 text-sm leading-relaxed outline-none placeholder:text-muted/70 focus:ring-4 focus:ring-brand/15"
          />
        </Section>

        <SubtaskList task={task} />
        <TimeSection task={task} onEstimate={(estimate_minutes) => set({ estimate_minutes })} />
        <CommentsSection taskId={task.id} />
      </div>
    </>
  )
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  )
}

function TimeSection({ task, onEstimate }: { task: Task; onEstimate: (m: number | null) => void }) {
  const { me, isManager } = useAuth()
  const { member } = useLookups()
  const running = useRunning().data
  const entries = useTaskTime(task.id).data ?? []
  const timer = useTimerActions()
  const [adding, setAdding] = useState(false)
  const [mins, setMins] = useState(60)
  const [day, setDay] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [note, setNote] = useState('')

  const isRunningHere = running?.task_id === task.id
  const elapsed = useElapsed(isRunningHere ? running?.started_at : undefined)
  const pct = task.estimate_minutes ? Math.min(100, (task.tracked_minutes / task.estimate_minutes) * 100) : 0
  const over = task.estimate_minutes != null && task.tracked_minutes > task.estimate_minutes

  return (
    <Section title="เวลาทำงาน" right={<EstimateField value={task.estimate_minutes} onChange={onEstimate} />}>
      <div className="rounded-2xl border border-line p-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold tabular-nums">{fmtMinutes(task.tracked_minutes)}</span>
              {isRunningHere && <span className="font-mono text-sm font-bold text-brand tabular-nums">+{fmtClock(elapsed)}</span>}
            </div>
            <div className="text-xs text-muted">
              {task.estimate_minutes ? (
                <>
                  จากที่ประมาณไว้ {fmtMinutes(task.estimate_minutes)}
                  {over && <span className="font-semibold text-warn"> · เกิน {fmtMinutes(task.tracked_minutes - task.estimate_minutes)}</span>}
                </>
              ) : (
                'ยังไม่ได้ประมาณเวลา'
              )}
            </div>
          </div>
          {isRunningHere ? (
            <button className="btn h-11 bg-danger px-4 text-white" onClick={() => timer.stop()} disabled={timer.busy}>
              <Square size={15} fill="currentColor" /> หยุด
            </button>
          ) : (
            <button className="btn-primary h-11 px-4" onClick={() => timer.start(task.id)} disabled={timer.busy}>
              <Play size={15} fill="currentColor" /> เริ่มจับเวลา
            </button>
          )}
        </div>
        {task.estimate_minutes ? (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-sunken">
            <div className={cn('h-full rounded-full transition-all', over ? 'bg-warn' : 'bg-brand')} style={{ width: `${pct}%` }} />
          </div>
        ) : null}

        {adding ? (
          <form
            className="mt-4 space-y-2.5 rounded-xl bg-sunken p-3"
            onSubmit={(e) => {
              e.preventDefault()
              const start = new Date(`${day}T09:00:00`)
              timer.add({ taskId: task.id, startedAt: start.toISOString(), minutes: mins, note })
              setAdding(false)
              setNote('')
            }}
          >
            <div className="flex flex-wrap gap-1.5">
              {[15, 30, 60, 90, 120, 240].map((m) => (
                <button type="button" key={m} onClick={() => setMins(m)} className={cn('chip', mins === m && 'chip-on')}>
                  {fmtMinutes(m)}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="number" min={5} step={5} className="input h-9 w-24" value={mins} onChange={(e) => setMins(+e.target.value)} />
              <span className="self-center text-xs text-muted">นาที</span>
              <input type="date" className="input h-9 flex-1" value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
            <input className="input h-9" placeholder="ทำอะไรไป (ไม่บังคับ)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost h-8" onClick={() => setAdding(false)}>
                ยกเลิก
              </button>
              <button className="btn-primary h-8" disabled={mins <= 0}>
                บันทึก
              </button>
            </div>
          </form>
        ) : (
          <button className="btn-ghost mt-3 h-8 px-2 text-xs text-muted" onClick={() => setAdding(true)}>
            <Plus size={14} /> ลืมกดจับเวลา? เพิ่มเวลาเอง
          </button>
        )}

        {entries.length > 0 && (
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {entries.map((e) => (
              <li key={e.id} className="group flex items-center gap-2.5 py-2 text-sm">
                <Avatar member={member(e.member_id)} size={22} />
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-muted">{fmtDate(e.started_at, 'EEE d MMM')}</span>
                  {e.note && <span> · {e.note}</span>}
                </span>
                <span className="font-semibold tabular-nums">{e.ended_at ? fmtMinutes(e.minutes) : <span className="text-brand">กำลังจับ…</span>}</span>
                {(e.member_id === me.id || isManager) && e.ended_at && (
                  <button
                    className="text-muted opacity-100 hover:text-danger md:opacity-0 md:group-hover:opacity-100"
                    onClick={() => confirm('ลบรายการเวลานี้?') && timer.del(e.id)}
                    aria-label="ลบ"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  )
}

function CommentsSection({ taskId }: { taskId: string }) {
  const { me, isAdmin } = useAuth()
  const { member } = useLookups()
  const comments = useComments(taskId).data ?? []
  const qc = useQueryClient()
  const toast = useToast()
  const [body, setBody] = useState('')
  const add = useMutation({
    mutationFn: () => api.addComment(taskId, body.trim()),
    onSuccess: () => {
      setBody('')
      qc.invalidateQueries({ queryKey: keys.comments(taskId) })
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })
  const del = useMutation({
    mutationFn: api.deleteComment,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.comments(taskId) }),
  })

  return (
    <Section title={`คอมเมนต์ ${comments.length ? `(${comments.length})` : ''}`}>
      <ul className="space-y-3">
        {comments.map((c) => {
          const who = member(c.member_id)
          return (
            <li key={c.id} className="group flex gap-2.5">
              <Avatar member={who} size={28} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 text-xs">
                  <b className="text-sm">{who?.full_name ?? '—'}</b>
                  <span className="text-muted">{fmtDate(c.created_at, 'd MMM HH:mm')}</span>
                  {(c.member_id === me.id || isAdmin) && (
                    <button className="ml-auto text-muted hover:text-danger md:opacity-0 md:group-hover:opacity-100" onClick={() => del.mutate(c.id)}>
                      ลบ
                    </button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{c.body}</p>
              </div>
            </li>
          )
        })}
      </ul>
      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (body.trim()) add.mutate()
        }}
      >
        <Avatar member={me} size={28} />
        <textarea
          rows={1}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && body.trim()) {
              e.preventDefault()
              add.mutate()
            }
          }}
          placeholder="เขียนคอมเมนต์… (Enter เพื่อส่ง)"
          className="input min-h-10 flex-1 resize-none py-2 [field-sizing:content]"
        />
        <button className="btn-primary h-10 w-10 px-0" disabled={!body.trim() || add.isPending} aria-label="ส่ง">
          <Send size={16} />
        </button>
      </form>
    </Section>
  )
}
