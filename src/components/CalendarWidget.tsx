import { useState } from 'react'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { th } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../lib/utils'

/** iOS-style "today" tile: weekday + month on top, a huge day number below. */
export function DateTile({ date = new Date() }: { date?: Date }) {
  return (
    <div className="card flex aspect-square flex-col items-center justify-center p-3 text-center lg:aspect-auto lg:py-4">
      <div className="text-lg font-bold leading-none md:text-xl">
        <span className="text-danger">{format(date, 'EEEE', { locale: th }).replace(/^วัน/, '')}</span>{' '}
        <span className="text-muted">{format(date, 'LLL', { locale: th })}</span>
      </div>
      <div className="mt-1 text-[72px] font-extrabold leading-none tracking-tighter tabular-nums md:text-[84px] lg:text-[64px]">{format(date, 'd')}</div>
    </div>
  )
}

/** Month grid with dots on days that have work; tap a day to select it. */
export function MiniCalendar({
  selected,
  onSelect,
  marks,
}: {
  selected: Date
  onSelect: (d: Date) => void
  /** yyyy-MM-dd → 'due' | 'overdue' | 'done' */
  marks: Map<string, 'due' | 'overdue' | 'done'>
}) {
  const [month, setMonth] = useState(startOfMonth(selected))
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) })
  return (
    <div className="card p-3">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-xs font-extrabold uppercase tracking-wide text-danger">{format(month, 'LLLL', { locale: th })}</span>
        <div className="flex">
          <button className="grid h-6 w-6 place-items-center rounded-lg text-muted hover:bg-sunken" onClick={() => setMonth(subMonths(month, 1))} aria-label="เดือนก่อน">
            <ChevronLeft size={14} />
          </button>
          <button className="grid h-6 w-6 place-items-center rounded-lg text-muted hover:bg-sunken" onClick={() => setMonth(addMonths(month, 1))} aria-label="เดือนถัดไป">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-bold text-muted">
        {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((d) => (
          <div key={d} className="py-0.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = format(d, 'yyyy-MM-dd')
          const mark = marks.get(key)
          const weekend = d.getDay() === 0 || d.getDay() === 6
          const sel = isSameDay(d, selected)
          return (
            <button
              key={key}
              onClick={() => {
                onSelect(d)
                if (!isSameMonth(d, month)) setMonth(startOfMonth(d))
              }}
              className="flex h-8 flex-col items-center justify-center"
              aria-label={format(d, 'd MMMM', { locale: th })}
            >
              <span
                className={cn(
                  'grid h-6 w-6 place-items-center rounded-full text-xs font-semibold tabular-nums transition',
                  !isSameMonth(d, month) ? 'invisible' : weekend ? 'text-muted' : 'text-ink',
                  isToday(d) && 'bg-danger font-bold text-white',
                  sel && !isToday(d) && 'bg-brand/15 text-brand ring-1 ring-brand/40',
                  !sel && !isToday(d) && 'hover:bg-sunken',
                )}
              >
                {format(d, 'd')}
              </span>
              <span
                className={cn(
                  'mt-0.5 h-1 w-1 rounded-full',
                  !isSameMonth(d, month) || !mark ? 'bg-transparent' : mark === 'overdue' ? 'bg-danger' : mark === 'done' ? 'bg-ok' : 'bg-brand',
                )}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
