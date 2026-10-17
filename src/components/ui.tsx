import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import type { Member } from '../lib/types'
import { cn, colorFor, initials } from '../lib/utils'

export function Avatar({ member, size = 28, className }: { member?: Member | null; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.38) }
  if (!member)
    return (
      <span
        style={style}
        className={cn('inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-line text-muted', className)}
        title="ยังไม่มอบหมาย"
      >
        ?
      </span>
    )
  if (member.avatar_url)
    return (
      <img
        src={member.avatar_url}
        alt={member.full_name}
        title={member.full_name}
        referrerPolicy="no-referrer"
        style={style}
        className={cn('shrink-0 rounded-full object-cover ring-2 ring-surface', className)}
      />
    )
  return (
    <span
      title={member.full_name}
      style={{ ...style, background: colorFor(member.id) }}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-surface', className)}
    >
      {initials(member.full_name || member.email)}
    </span>
  )
}

/** Anchored dropdown that becomes a bottom sheet on phones. */
export function Popover({
  trigger,
  children,
  align = 'left',
  width = 240,
  title,
}: {
  trigger: (open: () => void, isOpen: boolean) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  width?: number
  title?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; maxHeight: number } | null>(null)
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches

  useEffect(() => {
    if (!open || isMobile || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const left = Math.max(8, Math.min(align === 'right' ? r.right - width : r.left, window.innerWidth - width - 8))
    const below = window.innerHeight - r.bottom - 14
    const above = r.top - 14
    // open upward when the trigger sits near the bottom of the screen (e.g. the profile menu)
    setPos(
      below < 280 && above > below
        ? { bottom: window.innerHeight - r.top + 6, left, maxHeight: above }
        : { top: r.bottom + 6, left, maxHeight: below },
    )
  }, [open, align, width, isMobile])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const close = () => setOpen(false)
  return (
    <div ref={ref} className="inline-flex">
      {trigger(() => setOpen((o) => !o), open)}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[80]" onClick={close}>
            {isMobile ? (
              <div className="absolute inset-0 bg-black/40 animate-fade-in">
                <div
                  className="absolute bottom-0 inset-x-0 max-h-[75vh] overflow-auto rounded-t-3xl bg-surface p-3 pb-6 animate-slide-up safe-bottom"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line" />
                  {title && <div className="px-2 pb-2 text-sm font-bold">{title}</div>}
                  {children(close)}
                </div>
              </div>
            ) : (
              pos && (
                <div
                  style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width, maxHeight: Math.min(pos.maxHeight, window.innerHeight * 0.6) }}
                  className="absolute overflow-auto rounded-2xl border border-line bg-surface p-1.5 shadow-pop animate-fade-in"
                  onClick={(e) => e.stopPropagation()}
                >
                  {children(close)}
                </div>
              )
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}

export function MenuItem({
  children,
  onClick,
  selected,
  className,
}: {
  children: ReactNode
  onClick: () => void
  selected?: boolean
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm hover:bg-sunken',
        selected && 'font-semibold',
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2.5">{children}</span>
      {selected && <Check size={15} className="text-brand" />}
    </button>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40 animate-fade-in md:p-6" onClick={onClose}>
      <div
        className={cn(
          'flex max-h-[92vh] w-full flex-col rounded-t-3xl md:rounded-3xl bg-surface shadow-pop animate-slide-up',
          wide ? 'md:max-w-2xl' : 'md:max-w-lg',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="text-base font-bold">{title}</div>
          <button className="icon-btn -mr-2" onClick={onClose} aria-label="ปิด">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-auto px-5 pb-4">{children}</div>
        {footer && <div className="flex items-center gap-2 border-t border-line px-5 py-3 safe-bottom">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function Empty({ icon, title, hint, action }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="mb-1 grid h-12 w-12 place-items-center rounded-2xl bg-sunken text-2xl">{icon}</div>
      <div className="font-bold">{title}</div>
      {hint && <div className="max-w-xs text-sm text-muted">{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { id: T; label: ReactNode }[]
}) {
  return (
    <div className="inline-flex rounded-xl bg-sunken p-1">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 h-7 text-xs font-semibold transition',
            value === o.id ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Spinner() {
  return <div className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand" />
}
