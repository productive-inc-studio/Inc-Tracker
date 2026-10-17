import { useState, type ReactNode } from 'react'
import { CalendarDays, ChevronDown, Flag, Folder, Hourglass, Shapes, UserRound } from 'lucide-react'
import { useAuth } from '../auth'
import { useLookups } from '../data/hooks'
import { ESTIMATE_PRESETS, PRIORITIES, STATUSES, priorityMeta, statusMeta } from '../lib/meta'
import type { Priority, Status } from '../lib/types'
import { cn, fmtDate, fmtMinutes } from '../lib/utils'
import { Avatar, MenuItem, Popover } from './ui'

/** Pill-shaped trigger used for every task property. */
function Trigger({ onClick, children, empty, className }: { onClick: () => void; children: ReactNode; empty?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 max-w-full items-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold transition hover:bg-sunken',
        empty ? 'border-dashed border-line text-muted' : 'border-line bg-surface',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const s = statusMeta(status)
  return (
    <span className={cn('pill', s.tint, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  )
}

export function PriorityFlag({ priority, withLabel }: { priority: Priority; withLabel?: boolean }) {
  const p = priorityMeta(priority)
  if (priority === 'normal' && !withLabel) return null
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', p.color)} title={`ความสำคัญ: ${p.label}`}>
      <Flag size={13} fill={priority === 'urgent' || priority === 'high' ? 'currentColor' : 'none'} />
      {withLabel && p.label}
    </span>
  )
}

export function StatusField({ value, onChange }: { value: Status; onChange: (s: Status) => void }) {
  return (
    <Popover
      title="สถานะ"
      width={200}
      trigger={(open) => (
        <button type="button" onClick={open} className="inline-flex items-center gap-1">
          <StatusBadge status={value} className="h-8 px-3 text-xs" />
          <ChevronDown size={14} className="text-muted" />
        </button>
      )}
    >
      {(close) =>
        STATUSES.map((s) => (
          <MenuItem key={s.id} selected={s.id === value} onClick={() => (onChange(s.id), close())}>
            <span className={cn('h-2.5 w-2.5 rounded-full', s.dot)} /> {s.label}
          </MenuItem>
        ))
      }
    </Popover>
  )
}

export function PriorityField({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <Popover
      title="ความสำคัญ"
      width={190}
      trigger={(open) => (
        <Trigger onClick={open}>
          <PriorityFlag priority={value} withLabel />
        </Trigger>
      )}
    >
      {(close) =>
        PRIORITIES.map((p) => (
          <MenuItem key={p.id} selected={p.id === value} onClick={() => (onChange(p.id), close())}>
            <PriorityFlag priority={p.id} withLabel />
          </MenuItem>
        ))
      }
    </Popover>
  )
}

export function AssigneeField({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const { me, isManager } = useAuth()
  const { members, member } = useLookups()
  const options = isManager ? members.filter((m) => m.role !== 'pending') : members.filter((m) => m.id === me.id)
  const current = member(value)
  return (
    <Popover
      title="มอบหมายให้"
      width={250}
      trigger={(open) => (
        <Trigger onClick={open} empty={!current}>
          {current ? <Avatar member={current} size={20} /> : <UserRound size={14} />}
          <span className="truncate">{current?.full_name ?? 'มอบหมาย'}</span>
        </Trigger>
      )}
    >
      {(close) => (
        <>
          <MenuItem selected={!value} onClick={() => (onChange(null), close())}>
            <Avatar size={24} /> ยังไม่มอบหมาย
          </MenuItem>
          {options.map((m) => (
            <MenuItem key={m.id} selected={m.id === value} onClick={() => (onChange(m.id), close())}>
              <Avatar member={m} size={24} />
              <span className="min-w-0">
                <span className="block truncate">{m.full_name}</span>
                {m.title && <span className="block truncate text-xs text-muted">{m.title}</span>}
              </span>
            </MenuItem>
          ))}
          {!isManager && <p className="px-2.5 py-2 text-xs text-muted">Member มอบหมายงานได้เฉพาะตัวเอง</p>}
        </>
      )}
    </Popover>
  )
}

export function ProjectField({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const { projects, project } = useLookups()
  const current = project(value)
  return (
    <Popover
      title="โปรเจกต์ / ลูกค้า"
      width={250}
      trigger={(open) => (
        <Trigger onClick={open} empty={!current}>
          {current ? <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: current.color }} /> : <Folder size={14} />}
          <span className="truncate">{current?.name ?? 'โปรเจกต์'}</span>
        </Trigger>
      )}
    >
      {(close) => (
        <>
          <MenuItem selected={!value} onClick={() => (onChange(null), close())}>
            <Folder size={16} className="text-muted" /> ไม่ระบุ
          </MenuItem>
          {projects
            .filter((p) => !p.archived || p.id === value)
            .map((p) => (
              <MenuItem key={p.id} selected={p.id === value} onClick={() => (onChange(p.id), close())}>
                <span className="h-3 w-3 shrink-0 rounded-[5px]" style={{ background: p.color }} />
                <span className="min-w-0">
                  <span className="block truncate">{p.name}</span>
                  {p.client && <span className="block truncate text-xs text-muted">{p.client}</span>}
                </span>
              </MenuItem>
            ))}
        </>
      )}
    </Popover>
  )
}

export function TypeField({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const { types, type } = useLookups()
  const current = type(value)
  return (
    <Popover
      title="ประเภทงาน"
      width={220}
      trigger={(open) => (
        <Trigger onClick={open} empty={!current}>
          {current ? <span>{current.emoji}</span> : <Shapes size={14} />}
          <span className="truncate">{current?.name ?? 'ประเภท'}</span>
        </Trigger>
      )}
    >
      {(close) => (
        <>
          <MenuItem selected={!value} onClick={() => (onChange(null), close())}>
            <Shapes size={16} className="text-muted" /> ไม่ระบุ
          </MenuItem>
          {types.map((t) => (
            <MenuItem key={t.id} selected={t.id === value} onClick={() => (onChange(t.id), close())}>
              <span className="w-5 text-center">{t.emoji}</span> {t.name}
            </MenuItem>
          ))}
        </>
      )}
    </Popover>
  )
}

export function DateField({
  value,
  onChange,
  placeholder,
  tone,
}: {
  value: string | null
  onChange: (d: string | null) => void
  placeholder: string
  tone?: 'danger' | 'warn' | 'muted'
}) {
  return (
    <label
      className={cn(
        'relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold transition hover:bg-sunken',
        value ? 'border-line bg-surface' : 'border-dashed border-line text-muted',
        tone === 'danger' && 'border-danger/40 text-danger',
        tone === 'warn' && 'border-warn/40 text-warn',
      )}
    >
      <CalendarDays size={14} />
      {value ? fmtDate(value, 'd MMM yy') : placeholder}
      <input
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={placeholder}
      />
    </label>
  )
}

export function EstimateField({ value, onChange }: { value: number | null; onChange: (m: number | null) => void }) {
  const [custom, setCustom] = useState('')
  return (
    <Popover
      title="เวลาที่ประมาณไว้"
      width={250}
      trigger={(open) => (
        <Trigger onClick={open} empty={!value}>
          <Hourglass size={14} />
          {value ? `ประมาณ ${fmtMinutes(value)}` : 'ประมาณเวลา'}
        </Trigger>
      )}
    >
      {(close) => (
        <div className="p-1.5">
          <div className="grid grid-cols-3 gap-1.5">
            {ESTIMATE_PRESETS.map((p) => (
              <button
                key={p.minutes}
                onClick={() => (onChange(p.minutes), close())}
                className={cn('chip justify-center', value === p.minutes && 'chip-on')}
              >
                {p.label}
              </button>
            ))}
          </div>
          <form
            className="mt-2 flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              const h = parseFloat(custom)
              if (h > 0) onChange(Math.round(h * 60))
              setCustom('')
              close()
            }}
          >
            <input className="input h-9" inputMode="decimal" placeholder="กี่ชั่วโมง เช่น 1.5" value={custom} onChange={(e) => setCustom(e.target.value)} />
            <button className="btn-outline h-9">ตั้ง</button>
          </form>
          {value && (
            <button className="btn-danger mt-1.5 h-8 w-full" onClick={() => (onChange(null), close())}>
              ล้างค่า
            </button>
          )}
        </div>
      )}
    </Popover>
  )
}
