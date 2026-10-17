import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { BarChart3, Home, LayoutGrid, LogOut, Moon, Plus, Square, Sun, Users } from 'lucide-react'
import { useAuth } from '../auth'
import { DEMO, api, useLiveUpdates, useRunning, useTasks, useTimerActions } from '../data/hooks'
import { demoUsers, setDemoUser } from '../data/demo'
import { roleMeta } from '../lib/meta'
import type { TaskInput } from '../lib/types'
import { cn, fmtClock } from '../lib/utils'
import { Logo } from './Logo'
import { Avatar, Popover, MenuItem } from './ui'
import { TaskDrawer } from './TaskDrawer'
import { NewTaskModal } from './NewTaskModal'

// ─── UI context: open the new-task modal / a task from anywhere ──────────────
interface UI {
  newTask: (defaults?: TaskInput) => void
  openTask: (id: string) => void
}
const UICtx = createContext<UI>({ newTask: () => {}, openTask: () => {} })
export const useUI = () => useContext(UICtx)

// ─── Theme ───────────────────────────────────────────────────────────────────
function getTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem('wt-theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* storage blocked */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
export function applyTheme(t = getTheme()) {
  document.documentElement.dataset.theme = t
}
function useTheme() {
  const [theme, setTheme] = useState(getTheme)
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
    try {
      localStorage.setItem('wt-theme', next)
    } catch {
      /* storage blocked */
    }
  }
  return { theme, toggle }
}

// ─── Running timer ───────────────────────────────────────────────────────────
export function useElapsed(startedAt?: string) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!startedAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [startedAt])
  return startedAt ? (now - Date.parse(startedAt)) / 1000 : 0
}

export function RunningTimer({ compact }: { compact?: boolean }) {
  const running = useRunning().data
  const tasks = useTasks().data
  const { stop } = useTimerActions()
  const { openTask } = useUI()
  const elapsed = useElapsed(running?.started_at)
  if (!running) return null
  const task = tasks?.find((t) => t.id === running.task_id)
  if (compact)
    return (
      <button
        onClick={() => openTask(running.task_id)}
        className="flex items-center gap-1.5 rounded-full bg-brand px-2.5 h-8 text-xs font-bold text-brand-ink"
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-pop" />
        {fmtClock(elapsed)}
      </button>
    )
  return (
    <div className="rounded-2xl bg-brand p-3 text-brand-ink">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider opacity-80">
        <span className="h-2 w-2 animate-pulse rounded-full bg-pop" /> กำลังจับเวลา
      </div>
      <button className="mt-1 block w-full truncate text-left text-sm font-semibold" onClick={() => openTask(running.task_id)}>
        {task?.title ?? '…'}
      </button>
      <div className="mt-2 flex items-center justify-between">
        <span className="font-mono text-xl font-bold tabular-nums">{fmtClock(elapsed)}</span>
        <button onClick={() => stop()} className="grid h-8 w-8 place-items-center rounded-xl bg-white/20 hover:bg-white/30" aria-label="หยุด">
          <Square size={14} fill="currentColor" />
        </button>
      </div>
    </div>
  )
}

// ─── Navigation ──────────────────────────────────────────────────────────────
const NAV = [
  { to: '/', label: 'หน้าหลัก', icon: Home, end: true },
  { to: '/tasks', label: 'งานทั้งหมด', icon: LayoutGrid },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/team', label: 'ทีม', icon: Users },
]

function UserMenu({ align = 'left' }: { align?: 'left' | 'right' }) {
  const { me } = useAuth()
  const { theme, toggle } = useTheme()
  const qc = useQueryClient()
  return (
    <Popover
      align={align}
      width={260}
      trigger={(open) => (
        <button onClick={open} className="flex min-w-0 items-center gap-2.5 rounded-xl p-1.5 hover:bg-sunken">
          <Avatar member={me} size={32} />
          <span className="hidden min-w-0 text-left md:block">
            <span className="block truncate text-sm font-semibold">{me.full_name}</span>
            <span className="block text-xs text-muted">{roleMeta(me.role).label}</span>
          </span>
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="px-2.5 py-2">
            <div className="truncate font-semibold">{me.full_name}</div>
            <div className="truncate text-xs text-muted">{me.email}</div>
          </div>
          <div className="my-1 h-px bg-line" />
          <MenuItem onClick={toggle}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} {theme === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด'}
          </MenuItem>
          {DEMO && (
            <>
              <div className="my-1 h-px bg-line" />
              <div className="px-2.5 py-1 text-[11px] font-bold uppercase text-muted">Demo: สลับผู้ใช้</div>
              {demoUsers.map((u) => (
                <MenuItem
                  key={u.id}
                  selected={u.id === me.id}
                  onClick={() => {
                    setDemoUser(u.id)
                    qc.invalidateQueries()
                    close()
                  }}
                >
                  <Avatar member={u} size={22} /> {u.full_name} <span className="text-xs text-muted">{roleMeta(u.role).label}</span>
                </MenuItem>
              ))}
            </>
          )}
          <div className="my-1 h-px bg-line" />
          <MenuItem onClick={() => api.signOut()} className="text-danger">
            <LogOut size={16} /> ออกจากระบบ
          </MenuItem>
        </>
      )}
    </Popover>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  useLiveUpdates()
  const [params, setParams] = useSearchParams()
  const [newTask, setNewTask] = useState<TaskInput | null>(null)
  const openId = params.get('task')

  const ui: UI = {
    newTask: (d) => setNewTask(d ?? {}),
    openTask: (id) =>
      setParams((p) => {
        p.set('task', id)
        return p
      }),
  }
  const closeTask = () =>
    setParams((p) => {
      p.delete('task')
      return p
    })

  return (
    <UICtx.Provider value={ui}>
      <div className="flex min-h-full">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface p-3 md:flex">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <Logo size={30} />
            <div className="text-[15px] font-extrabold tracking-tight">
              Work<span className="text-brand">Tracker</span>
            </div>
          </div>
          <button className="btn-primary mt-4 h-10 w-full" onClick={() => ui.newTask()}>
            <Plus size={17} /> สร้างงาน
          </button>
          <nav className="mt-4 flex flex-col gap-0.5">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                    isActive ? 'bg-brand/10 text-brand' : 'text-muted hover:bg-sunken hover:text-ink',
                  )
                }
              >
                <n.icon size={18} /> {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-3">
            <RunningTimer />
            <UserMenu />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile header */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/85 px-4 backdrop-blur md:hidden">
            <Logo size={26} />
            <div className="text-[15px] font-extrabold tracking-tight">
              Work<span className="text-brand">Tracker</span>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <RunningTimer compact />
              <UserMenu align="right" />
            </div>
          </header>

          <main className="flex-1 px-4 pb-28 pt-4 md:px-8 md:pb-10 md:pt-7">{children}</main>
        </div>

        {/* Mobile tab bar */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden safe-bottom">
          <div className="grid h-16 grid-cols-5 items-center">
            {NAV.slice(0, 2).map((n) => (
              <TabLink key={n.to} {...n} />
            ))}
            <div className="flex justify-center">
              <button
                onClick={() => ui.newTask()}
                className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-brand-ink shadow-pop active:scale-95"
                aria-label="สร้างงาน"
              >
                <Plus size={24} />
              </button>
            </div>
            {NAV.slice(2).map((n) => (
              <TabLink key={n.to} {...n} />
            ))}
          </div>
        </nav>
      </div>

      {openId && <TaskDrawer taskId={openId} onClose={closeTask} />}
      <NewTaskModal defaults={newTask} onClose={() => setNewTask(null)} />
    </UICtx.Provider>
  )
}

function TabLink({ to, label, icon: Icon, end }: (typeof NAV)[number]) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn('flex flex-col items-center gap-0.5 text-[10px] font-semibold', isActive ? 'text-brand' : 'text-muted')
      }
    >
      <Icon size={21} />
      {label}
    </NavLink>
  )
}
