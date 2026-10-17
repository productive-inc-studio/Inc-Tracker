import { useEffect, useState } from 'react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import type { Task } from './types'

export { clsx as cn } from 'clsx'

export const todayISO = () => format(new Date(), 'yyyy-MM-dd')

/** "1ชม 30น", "45น", "0น" */
export function fmtMinutes(min: number | null | undefined) {
  const m = Math.max(0, Math.round(min ?? 0))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (!h) return `${r}น`
  return r ? `${h}ชม ${r}น` : `${h}ชม`
}

export const fmtHours = (min: number) => `${(min / 60).toFixed(min >= 600 ? 0 : 1)} ชม.`

export function fmtClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return [h, m, s % 60].map((x) => String(x).padStart(2, '0')).join(':')
}

export const fmtDate = (iso: string, pattern = 'd MMM') => format(parseISO(iso), pattern, { locale: th })

export function dueInfo(task: Pick<Task, 'due_date' | 'status'>) {
  if (!task.due_date) return null
  const days = differenceInCalendarDays(parseISO(task.due_date), new Date())
  const open = task.status !== 'done'
  let label: string
  if (days === 0) label = 'วันนี้'
  else if (days === 1) label = 'พรุ่งนี้'
  else if (days === -1) label = 'เมื่อวาน'
  else if (days < 0) label = `เลย ${-days} วัน`
  else if (days <= 6) label = `อีก ${days} วัน`
  else label = fmtDate(task.due_date)
  const tone: 'danger' | 'warn' | 'muted' = open && days < 0 ? 'danger' : open && days <= 1 ? 'warn' : 'muted'
  return { days, label, tone, overdue: open && days < 0 }
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase()
}

const AVATAR_COLORS = ['#6D4AFF', '#FF5C8A', '#FF8A3D', '#2BC48A', '#22B8CF', '#3D7BFF', '#C04BFF', '#E0A800']
export function colorFor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 11) return 'อรุณสวัสดิ์'
  if (h < 17) return 'สวัสดีตอนบ่าย'
  return 'สวัสดีตอนเย็น'
}

/** Resolve theme color tokens (e.g. 'brand') to rgb() strings for SVG attributes, re-reading on theme change. */
export function useThemeColors<K extends string>(names: K[]): Record<K, string> {
  const read = () => {
    const css = getComputedStyle(document.documentElement)
    return Object.fromEntries(names.map((n) => [n, `rgb(${css.getPropertyValue(`--${n}`).trim().replace(/ /g, ',')})`])) as Record<K, string>
  }
  const [colors, setColors] = useState(read)
  useEffect(() => {
    const obs = new MutationObserver(() => setColors(read()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return colors
}
