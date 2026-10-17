import { useEffect, useState } from 'react'
import { differenceInCalendarDays, isSameMonth, isSameWeek, parseISO } from 'date-fns'
import { ChevronDown, Search, X } from 'lucide-react'
import { useAuth } from '../auth'
import { useLookups } from '../data/hooks'
import { PRIORITIES, STATUSES } from '../lib/meta'
import type { Priority, Status, Task } from '../lib/types'
import { cn } from '../lib/utils'
import { PriorityFlag } from './fields'
import { Avatar, MenuItem, Popover } from './ui'

export type DueFilter = 'any' | 'overdue' | 'today' | 'week' | 'month' | 'none'
export interface Filters {
  q: string
  mine: boolean
  assignees: string[]
  statuses: Status[]
  priorities: Priority[]
  projects: string[]
  types: string[]
  due: DueFilter
  hideDone: boolean
}
const EMPTY: Filters = { q: '', mine: false, assignees: [], statuses: [], priorities: [], projects: [], types: [], due: 'any', hideDone: false }

const DUE_OPTIONS: { id: DueFilter; label: string }[] = [
  { id: 'any', label: 'ทุกกำหนดส่ง' },
  { id: 'overdue', label: '🔥 เลยกำหนด' },
  { id: 'today', label: 'ส่งวันนี้' },
  { id: 'week', label: 'สัปดาห์นี้' },
  { id: 'month', label: 'เดือนนี้' },
  { id: 'none', label: 'ไม่มีกำหนดส่ง' },
]

export function useFilters(storageKey: string) {
  const [f, setF] = useState<Filters>(() => {
    try {
      return { ...EMPTY, ...JSON.parse(localStorage.getItem(storageKey) || '{}'), q: '' }
    } catch {
      return EMPTY
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(f))
    } catch {
      /* storage blocked */
    }
  }, [f, storageKey])
  return [f, setF] as const
}

export function applyFilters(tasks: Task[], f: Filters, meId: string) {
  const q = f.q.trim().toLowerCase()
  const today = new Date()
  return tasks.filter((t) => {
    if (q && !t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false
    if (f.mine && t.assignee_id !== meId) return false
    if (f.assignees.length && !f.assignees.includes(t.assignee_id ?? '')) return false
    if (f.statuses.length && !f.statuses.includes(t.status)) return false
    if (f.hideDone && t.status === 'done') return false
    if (f.priorities.length && !f.priorities.includes(t.priority)) return false
    if (f.projects.length && !f.projects.includes(t.project_id ?? '')) return false
    if (f.types.length && !f.types.includes(t.type_id ?? '')) return false
    if (f.due !== 'any') {
      if (f.due === 'none') return !t.due_date
      if (!t.due_date) return false
      const d = parseISO(t.due_date)
      const diff = differenceInCalendarDays(d, today)
      if (f.due === 'overdue' && !(diff < 0 && t.status !== 'done')) return false
      if (f.due === 'today' && diff !== 0) return false
      if (f.due === 'week' && !isSameWeek(d, today, { weekStartsOn: 1 })) return false
      if (f.due === 'month' && !isSameMonth(d, today)) return false
    }
    return true
  })
}

const activeCount = (f: Filters) =>
  [f.mine, f.assignees.length, f.statuses.length, f.priorities.length, f.projects.length, f.types.length, f.due !== 'any', f.hideDone].filter(Boolean).length

function toggle<T>(list: T[], v: T) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

function FilterChip({ label, count, children, title }: { label: string; count: number; title: string; children: (close: () => void) => React.ReactNode }) {
  return (
    <Popover
      title={title}
      width={250}
      trigger={(open) => (
        <button onClick={open} className={cn('chip', count > 0 && 'border-brand/40 bg-brand/10 text-brand hover:bg-brand/15')}>
          {label}
          {count > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] text-brand-ink">{count}</span>}
          <ChevronDown size={13} className="opacity-60" />
        </button>
      )}
    >
      {children}
    </Popover>
  )
}

export function FilterBar({ value: f, onChange, hideStatus }: { value: Filters; onChange: (f: Filters) => void; hideStatus?: boolean }) {
  const { isManager } = useAuth()
  const { members, projects, types } = useLookups()
  const set = (patch: Partial<Filters>) => onChange({ ...f, ...patch })
  const n = activeCount(f)

  return (
    <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
      <label className="relative md:w-64">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input h-9 pl-9" placeholder="ค้นหางาน…" value={f.q} onChange={(e) => set({ q: e.target.value })} />
        {f.q && (
          <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted" onClick={() => set({ q: '' })} aria-label="ล้าง">
            <X size={15} />
          </button>
        )}
      </label>

      <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-0.5 scrollbar-none md:mx-0 md:flex-wrap md:px-0">
        {isManager && (
          <button className={cn('chip', f.mine && 'chip-on')} onClick={() => set({ mine: !f.mine, assignees: [] })}>
            👤 งานของฉัน
          </button>
        )}
        {isManager && !f.mine && (
          <FilterChip label="คนทำ" title="ผู้รับผิดชอบ" count={f.assignees.length}>
            {() => (
              <>
                {members
                  .filter((m) => m.role !== 'pending')
                  .map((m) => (
                    <MenuItem key={m.id} selected={f.assignees.includes(m.id)} onClick={() => set({ assignees: toggle(f.assignees, m.id) })}>
                      <Avatar member={m} size={22} /> {m.full_name}
                    </MenuItem>
                  ))}
                <MenuItem selected={f.assignees.includes('')} onClick={() => set({ assignees: toggle(f.assignees, '') })}>
                  <Avatar size={22} /> ยังไม่มอบหมาย
                </MenuItem>
              </>
            )}
          </FilterChip>
        )}
        {!hideStatus && (
          <FilterChip label="สถานะ" title="สถานะ" count={f.statuses.length}>
            {() =>
              STATUSES.map((s) => (
                <MenuItem key={s.id} selected={f.statuses.includes(s.id)} onClick={() => set({ statuses: toggle(f.statuses, s.id) })}>
                  <span className={cn('h-2.5 w-2.5 rounded-full', s.dot)} /> {s.label}
                </MenuItem>
              ))
            }
          </FilterChip>
        )}
        <FilterChip label={DUE_OPTIONS.find((d) => d.id === f.due)!.label.replace('ทุกกำหนดส่ง', 'กำหนดส่ง')} title="กำหนดส่ง" count={f.due !== 'any' ? 1 : 0}>
          {(close) =>
            DUE_OPTIONS.map((d) => (
              <MenuItem key={d.id} selected={f.due === d.id} onClick={() => (set({ due: d.id }), close())}>
                {d.label}
              </MenuItem>
            ))
          }
        </FilterChip>
        <FilterChip label="โปรเจกต์" title="โปรเจกต์" count={f.projects.length}>
          {() => (
            <>
              {projects.map((p) => (
                <MenuItem key={p.id} selected={f.projects.includes(p.id)} onClick={() => set({ projects: toggle(f.projects, p.id) })}>
                  <span className="h-3 w-3 rounded-[5px]" style={{ background: p.color }} /> {p.name}
                </MenuItem>
              ))}
              <MenuItem selected={f.projects.includes('')} onClick={() => set({ projects: toggle(f.projects, '') })}>
                <span className="h-3 w-3 rounded-[5px] border border-dashed border-muted" /> ไม่ระบุ
              </MenuItem>
            </>
          )}
        </FilterChip>
        <FilterChip label="ประเภท" title="ประเภทงาน" count={f.types.length}>
          {() =>
            types.map((t) => (
              <MenuItem key={t.id} selected={f.types.includes(t.id)} onClick={() => set({ types: toggle(f.types, t.id) })}>
                <span className="w-5 text-center">{t.emoji}</span> {t.name}
              </MenuItem>
            ))
          }
        </FilterChip>
        <FilterChip label="ความสำคัญ" title="ความสำคัญ" count={f.priorities.length}>
          {() =>
            PRIORITIES.map((p) => (
              <MenuItem key={p.id} selected={f.priorities.includes(p.id)} onClick={() => set({ priorities: toggle(f.priorities, p.id) })}>
                <PriorityFlag priority={p.id} withLabel />
              </MenuItem>
            ))
          }
        </FilterChip>
        <button className={cn('chip', f.hideDone && 'chip-on')} onClick={() => set({ hideDone: !f.hideDone })}>
          ซ่อนงานเสร็จ
        </button>
        {n > 0 && (
          <button className="chip border-transparent text-muted" onClick={() => onChange({ ...EMPTY, q: f.q })}>
            <X size={13} /> ล้างตัวกรอง
          </button>
        )}
      </div>
    </div>
  )
}
