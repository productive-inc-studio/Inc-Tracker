import { formatDistanceToNowStrict, isToday, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import { AtSign, Bell, CheckCheck, CircleCheckBig, Eye, ListChecks, UserPlus } from 'lucide-react'
import { useLookups, useMarkRead, useNotifications } from '../data/hooks'
import type { AppNotification, NotificationKind } from '../lib/types'
import { cn } from '../lib/utils'
import { useUI } from '../components/Layout'
import { Avatar, Empty, Spinner } from '../components/ui'

const KIND: Record<NotificationKind, { icon: typeof Bell; tint: string; verb: string }> = {
  assigned: { icon: UserPlus, tint: 'bg-brand text-brand-ink', verb: 'มอบหมายงานให้คุณ' },
  subtask_assigned: { icon: ListChecks, tint: 'bg-info text-white', verb: 'มอบหมายข้อย่อยให้คุณ' },
  comment: { icon: AtSign, tint: 'bg-warn text-white', verb: 'คอมเมนต์ในงาน' },
  review: { icon: Eye, tint: 'bg-warn text-white', verb: 'ส่งงานให้ตรวจ' },
  done: { icon: CircleCheckBig, tint: 'bg-ok text-white', verb: 'ปิดงานที่คุณสร้าง' },
}

/** One-line text for a notification, shared with the pop-up toast. */
export function notificationText(n: AppNotification, actorName?: string) {
  return `${actorName ?? 'มีคน'}${KIND[n.kind]?.verb ?? 'อัปเดตงาน'}: ${n.title}`
}

export function NotificationsPage() {
  const q = useNotifications()
  const markRead = useMarkRead()
  const { member } = useLookups()
  const { openTask } = useUI()
  const list = q.data ?? []
  const unread = list.filter((n) => !n.read_at).length
  const today = list.filter((n) => isToday(parseISO(n.created_at)))
  const earlier = list.filter((n) => !isToday(parseISO(n.created_at)))

  const open = (n: AppNotification) => {
    if (!n.read_at) markRead([n.id])
    if (n.task_id) openTask(n.task_id)
  }

  const Row = ({ n }: { n: AppNotification }) => {
    const k = KIND[n.kind] ?? KIND.assigned
    const actor = member(n.actor_id)
    return (
      <li>
        <button onClick={() => open(n)} className={cn('flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-sunken/60', !n.read_at && 'bg-brand/5')}>
          <span className="relative mt-0.5 shrink-0">
            <Avatar member={actor} size={36} />
            <span className={cn('absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full ring-2 ring-surface', k.tint)}>
              <k.icon size={11} />
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm leading-snug">
              <b>{actor?.full_name ?? 'มีคน'}</b> {k.verb}
            </span>
            <span className="mt-0.5 block truncate text-sm font-semibold text-brand">{n.title}</span>
            {n.body && (
              <span className="mt-1 block truncate text-xs text-muted">
                {n.kind === 'subtask_assigned' ? `ในงาน: ${n.body}` : `“${n.body}”`}
              </span>
            )}
            <span className="mt-1 block text-[11px] text-muted">
              {formatDistanceToNowStrict(parseISO(n.created_at), { locale: th, addSuffix: true })}
            </span>
          </span>
          {!n.read_at && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" aria-label="ยังไม่อ่าน" />}
        </button>
      </li>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">แจ้งเตือน</h1>
          <p className="text-sm text-muted">{unread ? `ยังไม่อ่าน ${unread} รายการ` : 'อ่านครบแล้ว'}</p>
        </div>
        {unread > 0 && (
          <button className="btn-outline" onClick={() => markRead(undefined)}>
            <CheckCheck size={16} /> อ่านทั้งหมด
          </button>
        )}
      </div>

      {q.isLoading ? (
        <div className="grid place-items-center py-20">
          <Spinner />
        </div>
      ) : !list.length ? (
        <div className="card">
          <Empty icon="🔔" title="ยังไม่มีแจ้งเตือน" hint="เมื่อมีคนมอบหมายงาน ข้อย่อย หรือคอมเมนต์ในงานของคุณ จะแจ้งที่นี่" />
        </div>
      ) : (
        <div className="space-y-5">
          {today.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">วันนี้</h2>
              <ul className="card divide-y divide-line overflow-hidden">
                {today.map((n) => (
                  <Row key={n.id} n={n} />
                ))}
              </ul>
            </section>
          )}
          {earlier.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">ก่อนหน้านี้</h2>
              <ul className="card divide-y divide-line overflow-hidden">
                {earlier.map((n) => (
                  <Row key={n.id} n={n} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
