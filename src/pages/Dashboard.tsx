import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { addMonths, eachDayOfInterval, endOfMonth, format, isAfter, parseISO, startOfMonth, subMonths } from 'date-fns'
import { th } from 'date-fns/locale'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChevronLeft, ChevronRight, Send } from 'lucide-react'
import { useAuth } from '../auth'
import { api, useLookups, useTasks, useTimeRange } from '../data/hooks'
import type { Member, Task, TimeEntry } from '../lib/types'
import { cn, fmtHours, fmtMinutes, todayISO, useThemeColors } from '../lib/utils'
import { Avatar, MenuItem, Popover, Spinner } from '../components/ui'
import { useToast } from '../components/Toast'
import { useUI } from '../components/Layout'

interface Kpi {
  done: number
  dueInMonth: number
  onTimeRate: number | null
  minutes: number
  avgPerTask: number | null
  estRatio: number | null
  overdueOpen: number
  open: number
}

function computeKpi(tasks: Task[], entries: TimeEntry[], monthKey: string): Kpi {
  const done = tasks.filter((t) => t.completed_at?.startsWith(monthKey))
  const withDue = done.filter((t) => t.due_date)
  const onTime = withDue.filter((t) => format(parseISO(t.completed_at!), 'yyyy-MM-dd') <= t.due_date!)
  const withEst = done.filter((t) => t.estimate_minutes && t.tracked_minutes)
  const est = withEst.reduce((s, t) => s + t.estimate_minutes!, 0)
  const act = withEst.reduce((s, t) => s + t.tracked_minutes, 0)
  const minutes = entries.reduce((s, e) => s + (e.minutes ?? 0), 0)
  const today = todayISO()
  const tracked = done.filter((t) => t.tracked_minutes > 0)
  return {
    done: done.length,
    dueInMonth: tasks.filter((t) => t.due_date?.startsWith(monthKey)).length,
    onTimeRate: withDue.length ? onTime.length / withDue.length : null,
    minutes,
    avgPerTask: tracked.length ? tracked.reduce((s, t) => s + t.tracked_minutes, 0) / tracked.length : null,
    estRatio: est ? act / est : null,
    overdueOpen: tasks.filter((t) => t.status !== 'done' && t.due_date && t.due_date < today).length,
    open: tasks.filter((t) => t.status !== 'done').length,
  }
}

export function DashboardPage() {
  const { me, isManager } = useAuth()
  const { members, types, projects, member } = useLookups()
  const allTasks = useTasks().data
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const [scope, setScope] = useState<string>(isManager ? 'team' : me.id)
  const from = month.toISOString()
  const to = addMonths(month, 1).toISOString()
  const time = useTimeRange(from, to)
  const monthKey = format(month, 'yyyy-MM')
  const isFuture = isAfter(month, new Date())

  const scoped = useMemo(() => {
    const tasks = (allTasks ?? []).filter((t) => scope === 'team' || t.assignee_id === scope)
    const entries = (time.data ?? []).filter((e) => e.ended_at && (scope === 'team' || e.member_id === scope))
    return { tasks, entries }
  }, [allTasks, time.data, scope])

  const kpi = useMemo(() => computeKpi(scoped.tasks, scoped.entries, monthKey), [scoped, monthKey])
  const prevKey = format(subMonths(month, 1), 'yyyy-MM')
  const prevDone = scoped.tasks.filter((t) => t.completed_at?.startsWith(prevKey)).length

  const daily = useMemo(() => {
    const days = eachDayOfInterval({ start: month, end: endOfMonth(month) })
    return days.map((d) => {
      const key = format(d, 'yyyy-MM-dd')
      const m = scoped.entries.filter((e) => format(parseISO(e.started_at), 'yyyy-MM-dd') === key).reduce((s, e) => s + (e.minutes ?? 0), 0)
      return { day: format(d, 'd'), label: format(d, 'EEE d MMM', { locale: th }), hours: +(m / 60).toFixed(2) }
    })
  }, [scoped.entries, month])

  const taskById = useMemo(() => new Map((allTasks ?? []).map((t) => [t.id, t])), [allTasks])
  const byType = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of scoped.entries) {
      const k = taskById.get(e.task_id)?.type_id ?? ''
      m.set(k, (m.get(k) ?? 0) + (e.minutes ?? 0))
    }
    return [...m.entries()]
      .map(([id, minutes]) => {
        const t = types.find((x) => x.id === id)
        return { name: t ? `${t.emoji} ${t.name}` : 'ไม่ระบุ', minutes }
      })
      .sort((a, b) => b.minutes - a.minutes)
  }, [scoped.entries, taskById, types])

  const byProject = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of scoped.entries) {
      const k = taskById.get(e.task_id)?.project_id ?? ''
      m.set(k, (m.get(k) ?? 0) + (e.minutes ?? 0))
    }
    return [...m.entries()]
      .map(([id, minutes]) => {
        const p = projects.find((x) => x.id === id)
        return { name: p?.name ?? 'ไม่ระบุโปรเจกต์', color: p?.color, minutes }
      })
      .sort((a, b) => b.minutes - a.minutes)
  }, [scoped.entries, taskById, projects])

  const team = useMemo(() => {
    if (scope !== 'team') return []
    return members
      .filter((m) => m.role !== 'pending')
      .map((m) => ({
        member: m,
        kpi: computeKpi(
          (allTasks ?? []).filter((t) => t.assignee_id === m.id),
          (time.data ?? []).filter((e) => e.member_id === m.id && e.ended_at),
          monthKey,
        ),
      }))
      .sort((a, b) => b.kpi.done - a.kpi.done || b.kpi.minutes - a.kpi.minutes)
  }, [scope, members, allTasks, time.data, monthKey])

  const c = useThemeColors(['brand', 'line', 'muted', 'sunken'])
  const scopeMember = scope === 'team' ? null : member(scope)
  if (!allTasks || time.isLoading)
    return (
      <div className="grid place-items-center py-24">
        <Spinner />
      </div>
    )

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted">สรุปผลงานรายเดือน {scopeMember ? `ของ ${scopeMember.full_name}` : 'ทั้งทีม'}</p>
        </div>
        {isManager && <ScopePicker value={scope} onChange={setScope} members={members} />}
        <div className="flex items-center rounded-xl border border-line bg-surface">
          <button className="icon-btn" onClick={() => setMonth(subMonths(month, 1))} aria-label="เดือนก่อน">
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-[124px] text-center text-sm font-bold">{format(month, 'LLLL yyyy', { locale: th })}</span>
          <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} disabled={isFuture} aria-label="เดือนถัดไป">
            <ChevronRight size={18} />
          </button>
        </div>
        {isManager && <LineSummaryButton />}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="งานที่ปิดได้"
          value={kpi.done}
          sub={prevDone ? `${kpi.done >= prevDone ? '▲' : '▼'} เดือนก่อน ${prevDone}` : `ครบกำหนดเดือนนี้ ${kpi.dueInMonth} งาน`}
          accent
        />
        <Tile
          label="ส่งตรงเวลา"
          value={kpi.onTimeRate == null ? '—' : `${Math.round(kpi.onTimeRate * 100)}%`}
          sub="ของงานที่มีกำหนดส่ง"
          tone={kpi.onTimeRate == null ? undefined : kpi.onTimeRate >= 0.8 ? 'ok' : kpi.onTimeRate >= 0.6 ? 'warn' : 'danger'}
        />
        <Tile label="ชั่วโมงทำงาน" value={fmtHours(kpi.minutes)} sub={kpi.avgPerTask ? `เฉลี่ย ${fmtMinutes(kpi.avgPerTask)} / งาน` : 'จากการจับเวลา'} />
        <Tile
          label="เวลาจริง vs ประมาณ"
          value={kpi.estRatio == null ? '—' : `${Math.round(kpi.estRatio * 100)}%`}
          sub={kpi.estRatio == null ? 'ยังไม่มีงานที่ประมาณเวลา' : kpi.estRatio > 1.15 ? 'ใช้เวลาเกินที่ประมาณ' : kpi.estRatio < 0.85 ? 'เร็วกว่าที่ประมาณ' : 'ประมาณได้แม่น 👌'}
          tone={kpi.estRatio == null ? undefined : kpi.estRatio > 1.3 ? 'warn' : 'ok'}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="pill bg-sunken text-muted">งานค้างตอนนี้ {kpi.open}</span>
        <span className={cn('pill', kpi.overdueOpen ? 'bg-danger/10 text-danger' : 'bg-sunken text-muted')}>เลยกำหนดตอนนี้ {kpi.overdueOpen}</span>
      </div>

      <div className="mt-5 card p-5">
        <ChartTitle title="ชั่วโมงทำงานรายวัน" note={`รวม ${fmtHours(kpi.minutes)}`} />
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barCategoryGap={2}>
              <CartesianGrid vertical={false} stroke={c.line} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} tick={{ fill: c.muted, fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fill: c.muted, fontSize: 11 }} />
              <Tooltip cursor={{ fill: c.sunken }} content={<HoursTip />} />
              <Bar dataKey="hours" fill={c.brand} radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <ChartTitle title="เวลาแยกตามประเภทงาน" />
          <RankBars rows={byType.map((r) => ({ label: r.name, minutes: r.minutes }))} />
        </div>
        <div className="card p-5">
          <ChartTitle title="เวลาแยกตามโปรเจกต์" />
          <RankBars
            rows={byProject.map((r) => ({
              label: (
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: r.color ?? 'rgb(var(--line))' }} />
                  <span className="truncate">{r.name}</span>
                </span>
              ),
              minutes: r.minutes,
            }))}
          />
        </div>
      </div>

      {scope === 'team' && team.length > 0 && <TeamTable rows={team} onPick={setScope} />}
      {scope !== 'team' && <MemberTasks tasks={scoped.tasks.filter((t) => t.completed_at?.startsWith(monthKey))} />}
    </div>
  )
}

function Tile({ label, value, sub, tone, accent }: { label: string; value: React.ReactNode; sub?: string; tone?: 'ok' | 'warn' | 'danger'; accent?: boolean }) {
  return (
    <div className={cn('rounded-2xl border p-4', accent ? 'border-brand bg-brand text-brand-ink' : 'card')}>
      <div className={cn('text-xs font-semibold', accent ? 'opacity-80' : 'text-muted')}>{label}</div>
      <div
        className={cn(
          'mt-1 text-[28px] font-extrabold leading-tight tabular-nums',
          tone === 'ok' && 'text-ok',
          tone === 'warn' && 'text-warn',
          tone === 'danger' && 'text-danger',
        )}
      >
        {value}
      </div>
      {sub && <div className={cn('mt-0.5 text-xs', accent ? 'opacity-80' : 'text-muted')}>{sub}</div>}
    </div>
  )
}

function ChartTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-sm font-bold">{title}</h2>
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
  )
}

function HoursTip({ active, payload }: { active?: boolean; payload?: { payload: { label: string; hours: number } }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      <div className="text-muted">{p.label}</div>
      <div className="mt-0.5 text-sm font-bold">{fmtMinutes(p.hours * 60)}</div>
    </div>
  )
}

function RankBars({ rows }: { rows: { label: React.ReactNode; minutes: number }[] }) {
  if (!rows.length) return <div className="py-8 text-center text-sm text-muted">ยังไม่มีการจับเวลาเดือนนี้</div>
  const max = Math.max(...rows.map((r) => r.minutes), 1)
  const total = rows.reduce((s, r) => s + r.minutes, 0)
  return (
    <ul className="space-y-2.5">
      {rows.slice(0, 8).map((r, i) => (
        <li key={i} className="group" title={`${fmtMinutes(r.minutes)} · ${Math.round((r.minutes / total) * 100)}%`}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-muted">
              {fmtMinutes(r.minutes)} <span className="opacity-60">· {Math.round((r.minutes / total) * 100)}%</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-sunken">
            <div className="h-full rounded-full bg-brand transition-all group-hover:brightness-110" style={{ width: `${(r.minutes / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function TeamTable({ rows, onPick }: { rows: { member: Member; kpi: Kpi }[]; onPick: (id: string) => void }) {
  const maxMin = Math.max(...rows.map((r) => r.kpi.minutes), 1)
  return (
    <div className="mt-4 card overflow-hidden">
      <div className="px-5 pt-5">
        <ChartTitle title="ผลงานรายคน" note="แตะชื่อเพื่อดูรายละเอียด" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-5 py-2 font-semibold">สมาชิก</th>
              <th className="px-3 py-2 text-right font-semibold">ปิดงาน</th>
              <th className="px-3 py-2 text-right font-semibold">ตรงเวลา</th>
              <th className="px-3 py-2 font-semibold">ชั่วโมง</th>
              <th className="px-3 py-2 text-right font-semibold">จริง/ประมาณ</th>
              <th className="px-5 py-2 text-right font-semibold">ค้าง (เลยกำหนด)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ member: m, kpi }) => (
              <tr key={m.id} className="cursor-pointer hover:bg-sunken/50" onClick={() => onPick(m.id)}>
                <td className="px-5 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar member={m} size={28} />
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{m.full_name}</div>
                      {m.title && <div className="truncate text-xs text-muted">{m.title}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums">{kpi.done}</td>
                <td
                  className={cn(
                    'px-3 py-2.5 text-right font-semibold tabular-nums',
                    kpi.onTimeRate == null ? 'text-muted' : kpi.onTimeRate >= 0.8 ? 'text-ok' : kpi.onTimeRate >= 0.6 ? 'text-warn' : 'text-danger',
                  )}
                >
                  {kpi.onTimeRate == null ? '—' : `${Math.round(kpi.onTimeRate * 100)}%`}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 rounded-full bg-sunken">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${(kpi.minutes / maxMin) * 100}%` }} />
                    </div>
                    <span className="text-xs font-semibold tabular-nums">{fmtHours(kpi.minutes)}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted">{kpi.estRatio == null ? '—' : `${Math.round(kpi.estRatio * 100)}%`}</td>
                <td className="px-5 py-2.5 text-right tabular-nums">
                  {kpi.open} {kpi.overdueOpen > 0 && <span className="font-semibold text-danger">({kpi.overdueOpen})</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MemberTasks({ tasks }: { tasks: Task[] }) {
  const { type } = useLookups()
  const { openTask } = useUI()
  return (
    <div className="mt-4 card p-5">
      <ChartTitle title="งานที่ปิดได้เดือนนี้" note={`${tasks.length} งาน`} />
      {tasks.length ? (
        <ul className="divide-y divide-line">
          {tasks
            .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
            .map((t) => {
              const late = t.due_date && t.completed_at && format(parseISO(t.completed_at), 'yyyy-MM-dd') > t.due_date
              return (
                <li key={t.id} className="flex cursor-pointer items-center gap-3 py-2.5 text-sm hover:text-brand" onClick={() => openTask(t.id)}>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {type(t.type_id)?.emoji} {t.title}
                  </span>
                  {late ? <span className="pill bg-warn/15 text-warn">ส่งช้า</span> : t.due_date ? <span className="pill bg-ok/10 text-ok">ตรงเวลา</span> : null}
                  <span className="w-20 text-right text-xs tabular-nums text-muted">
                    {fmtMinutes(t.tracked_minutes)}
                    {t.estimate_minutes ? `/${fmtMinutes(t.estimate_minutes)}` : ''}
                  </span>
                </li>
              )
            })}
        </ul>
      ) : (
        <div className="py-6 text-center text-sm text-muted">ยังไม่มีงานที่ปิดในเดือนนี้</div>
      )}
    </div>
  )
}

function ScopePicker({ value, onChange, members }: { value: string; onChange: (v: string) => void; members: Member[] }) {
  const current = members.find((m) => m.id === value)
  return (
    <Popover
      title="ดูผลงานของ"
      width={240}
      align="right"
      trigger={(open) => (
        <button onClick={open} className="btn-outline">
          {current ? <Avatar member={current} size={20} /> : '👥'}
          {current?.full_name ?? 'ทั้งทีม'}
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuItem selected={value === 'team'} onClick={() => (onChange('team'), close())}>
            <span className="w-6 text-center">👥</span> ทั้งทีม
          </MenuItem>
          {members
            .filter((m) => m.role !== 'pending')
            .map((m) => (
              <MenuItem key={m.id} selected={value === m.id} onClick={() => (onChange(m.id), close())}>
                <Avatar member={m} size={24} /> {m.full_name}
              </MenuItem>
            ))}
        </>
      )}
    </Popover>
  )
}

function LineSummaryButton() {
  const toast = useToast()
  const send = useMutation({
    mutationFn: () => api.notifyLine({ kind: 'summary' }),
    onSuccess: () => toast('ส่งสรุปเข้า LINE กลุ่มแล้ว'),
    onError: (e: Error) => toast(`ส่ง LINE ไม่สำเร็จ: ${e.message}`, 'error'),
  })
  return (
    <button
      className="btn h-9 bg-[#06C755] text-white hover:brightness-105"
      onClick={() => confirm('ส่งสรุปงานวันนี้เข้า LINE กลุ่ม?') && send.mutate()}
      disabled={send.isPending}
    >
      {send.isPending ? <Spinner /> : <Send size={15} />} สรุปเข้า LINE
    </button>
  )
}
