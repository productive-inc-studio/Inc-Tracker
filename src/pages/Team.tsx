import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, Check, Copy, Mail, Pencil, Plus, Send, Trash2, UserX } from 'lucide-react'
import { useAuth } from '../auth'
import { api, keys, useLookups } from '../data/hooks'
import { PROJECT_COLORS, ROLES, roleMeta } from '../lib/meta'
import type { Invite, Member, Project, Role, TaskType } from '../lib/types'
import { cn } from '../lib/utils'
import { Avatar, MenuItem, Modal, Popover, Segmented } from '../components/ui'
import { useToast } from '../components/Toast'

type Tab = 'members' | 'projects' | 'types'

export function TeamPage() {
  const { isManager } = useAuth()
  const [tab, setTab] = useState<Tab>('members')
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">ทีม</h1>
          <p className="text-sm text-muted">สมาชิก สิทธิ์การเข้าถึง และการตั้งค่า</p>
        </div>
        {isManager && (
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { id: 'members', label: 'สมาชิก' },
              { id: 'projects', label: 'โปรเจกต์' },
              { id: 'types', label: 'ประเภทงาน' },
            ]}
          />
        )}
      </div>
      {tab === 'members' && <Members />}
      {tab === 'projects' && <Projects />}
      {tab === 'types' && <Types />}
    </div>
  )
}

function useMutate<T>(fn: (v: T) => Promise<unknown>, invalidate: readonly unknown[][], ok?: string) {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      invalidate.forEach((k) => qc.invalidateQueries({ queryKey: k }))
      if (ok) toast(ok)
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })
}

// ─── Members ─────────────────────────────────────────────────────────────────
function Members() {
  const { me, isAdmin } = useAuth()
  const { members } = useLookups()
  const invites = useQuery({ queryKey: keys.invites, queryFn: api.listInvites, enabled: isAdmin })
  const setRole = useMutate((v: { id: string; role: Role }) => api.updateMember(v.id, { role: v.role }), [[...keys.members]], 'อัปเดตสิทธิ์แล้ว')
  const remove = useMutate((id: string) => api.removeMember(id), [[...keys.members]], 'นำออกจากทีมแล้ว')
  const [editing, setEditing] = useState<Member | null>(null)

  const pending = members.filter((m) => m.role === 'pending')
  const active = members.filter((m) => m.role !== 'pending')

  return (
    <div className="space-y-5">
      {isAdmin && pending.length > 0 && (
        <section className="card border-warn/40 p-4">
          <h2 className="mb-3 text-sm font-bold text-warn">รออนุมัติ ({pending.length})</h2>
          <ul className="space-y-2">
            {pending.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3">
                <Avatar member={m} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{m.full_name}</div>
                  <div className="truncate text-xs text-muted">{m.email}</div>
                </div>
                <button className="btn-primary h-8" onClick={() => setRole.mutate({ id: m.id, role: 'member' })}>
                  <Check size={15} /> อนุมัติเป็น Member
                </button>
                <button className="btn-danger h-8" onClick={() => confirm(`ปฏิเสธ ${m.email}?`) && remove.mutate(m.id)}>
                  ปฏิเสธ
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isAdmin && <InviteBox invites={invites.data ?? []} />}

      <section className="card divide-y divide-line">
        {active.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar member={m} size={38} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold">{m.full_name}</span>
                {m.id === me.id && <span className="pill bg-brand/10 text-brand">คุณ</span>}
              </div>
              <div className="truncate text-xs text-muted">{m.title || m.email}</div>
            </div>
            {isAdmin && m.id !== me.id ? (
              <Popover
                title={`สิทธิ์ของ ${m.full_name}`}
                align="right"
                width={280}
                trigger={(open) => (
                  <button onClick={open} className={cn('chip', m.role === 'admin' && 'border-brand/40 text-brand')}>
                    {roleMeta(m.role).label}
                  </button>
                )}
              >
                {(close) => (
                  <>
                    {ROLES.filter((r) => r.id !== 'pending').map((r) => (
                      <MenuItem key={r.id} selected={m.role === r.id} onClick={() => (setRole.mutate({ id: m.id, role: r.id }), close())}>
                        <span>
                          <span className="block font-semibold">{r.label}</span>
                          <span className="block text-xs text-muted">{r.desc}</span>
                        </span>
                      </MenuItem>
                    ))}
                    <div className="my-1 h-px bg-line" />
                    <MenuItem
                      className="text-danger"
                      onClick={() => {
                        close()
                        if (confirm(`ปิดการเข้าถึงของ ${m.full_name}? ประวัติงานและเวลายังเก็บไว้ครบ เปิดคืนได้จากรายการ "รออนุมัติ"`))
                          setRole.mutate({ id: m.id, role: 'pending' })
                      }}
                    >
                      <UserX size={16} /> ปิดการเข้าถึง
                    </MenuItem>
                  </>
                )}
              </Popover>
            ) : (
              <span className="pill bg-sunken text-muted">{roleMeta(m.role).label}</span>
            )}
            {(isAdmin || m.id === me.id) && (
              <button className="icon-btn" onClick={() => setEditing(m)} aria-label="แก้ไขโปรไฟล์">
                <Pencil size={15} />
              </button>
            )}
          </div>
        ))}
      </section>

      <div className="grid gap-2 text-xs text-muted sm:grid-cols-3">
        {ROLES.filter((r) => r.id !== 'pending').map((r) => (
          <div key={r.id} className="rounded-2xl bg-sunken/70 p-3">
            <b className="text-ink">{r.label}</b> — {r.desc}
          </div>
        ))}
      </div>

      {editing && <ProfileModal member={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

const APP_URL = window.location.origin + import.meta.env.BASE_URL

function inviteMessage(email: string, role: Invite['role']) {
  return [
    'คุณได้รับเชิญเข้าใช้ INC WorkTracker 🎉',
    `สิทธิ์: ${roleMeta(role).label}`,
    '',
    `เข้าสู่ระบบด้วย Google โดยใช้อีเมล ${email} ที่`,
    APP_URL,
  ].join('\n')
}

function InviteBox({ invites }: { invites: Invite[] }) {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Invite['role']>('member')
  const [sharing, setSharing] = useState<{ email: string; role: Invite['role'] } | null>(null)
  const create = useMutate((v: { email: string; role: Invite['role'] }) => api.createInvite(v.email, v.role), [[...keys.invites]])
  const del = useMutate((e: string) => api.deleteInvite(e), [[...keys.invites]])
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())

  const msg = sharing ? inviteMessage(sharing.email, sharing.role) : ''
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg)
      toast('คัดลอกข้อความเชิญแล้ว')
    } catch {
      toast('คัดลอกไม่ได้ ลองเลือกข้อความแล้วคัดลอกเอง', 'error')
    }
  }

  return (
    <section className="card p-4">
      <h2 className="text-sm font-bold">เชิญสมาชิกใหม่</h2>
      <p className="mb-3 mt-0.5 text-xs text-muted">
        ใส่อีเมล Google ของคนที่จะเชิญ แล้วส่งลิงก์ให้เขาทางอีเมลหรือ LINE เมื่อเขา login ครั้งแรกจะได้สิทธิ์ตามที่ตั้งไว้ทันที
      </p>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          const v = { email: email.trim().toLowerCase(), role }
          create.mutate(v, { onSuccess: () => setSharing(v) })
          setEmail('')
        }}
      >
        <label className="relative flex-1">
          <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-9" type="email" placeholder="name@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <div className="flex gap-2">
          <Segmented value={role} onChange={setRole} options={[{ id: 'member', label: 'Member' }, { id: 'lead', label: 'Lead' }, { id: 'admin', label: 'Admin' }]} />
          <button className="btn-primary h-10" disabled={!valid || create.isPending}>
            <Plus size={16} /> เชิญ
          </button>
        </div>
      </form>
      {invites.length > 0 && (
        <>
          <div className="mt-4 text-xs font-semibold text-muted">รอเข้าใช้งานครั้งแรก</div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {invites.map((i) => (
              <li key={i.email} className="chip h-8 pr-1">
                {i.email} <span className="text-muted">· {roleMeta(i.role).label}</span>
                <button
                  className="grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-brand/10 hover:text-brand"
                  onClick={() => setSharing({ email: i.email, role: i.role })}
                  aria-label="ส่งคำเชิญอีกครั้ง"
                  title="ส่งคำเชิญอีกครั้ง"
                >
                  <Send size={13} />
                </button>
                <button
                  className="grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-danger/10 hover:text-danger"
                  onClick={() => del.mutate(i.email)}
                  aria-label="ยกเลิกคำเชิญ"
                  title="ยกเลิกคำเชิญ"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {sharing && (
        <Modal open onClose={() => setSharing(null)} title="ส่งคำเชิญ">
          <p className="text-sm">
            เพิ่ม <b>{sharing.email}</b> ในรายชื่อแล้ว ส่งลิงก์นี้ให้เขาเพื่อเข้าใช้งาน
          </p>
          <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-sunken p-3 font-sans text-sm">{msg}</pre>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <a
              className="btn-outline h-10"
              href={`mailto:${sharing.email}?subject=${encodeURIComponent('เชิญเข้าใช้ INC WorkTracker')}&body=${encodeURIComponent(msg)}`}
            >
              <Mail size={16} /> ส่งอีเมล
            </a>
            <a
              className="btn h-10 bg-[#06C755] text-white hover:brightness-105"
              href={`https://line.me/R/share?text=${encodeURIComponent(msg)}`}
              target="_blank"
              rel="noopener"
            >
              <Send size={16} /> ส่งทาง LINE
            </a>
            <button className="btn-outline h-10" onClick={copy}>
              <Copy size={16} /> คัดลอกข้อความ
            </button>
          </div>
          <p className="mt-4 rounded-xl bg-warn/10 p-3 text-xs text-warn">
            ถ้าแอปใน Google Cloud ยังเป็นโหมด Testing ต้องเพิ่มอีเมลนี้ใน <b>Audience → Test users</b> ด้วย ไม่งั้นเขาจะ login ไม่ได้
          </p>
        </Modal>
      )}
    </section>
  )
}

function ProfileModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const [name, setName] = useState(member.full_name)
  const [title, setTitle] = useState(member.title ?? '')
  const save = useMutate(() => api.updateMember(member.id, { full_name: name.trim(), title: title.trim() || null }), [[...keys.members], [...keys.me]], 'บันทึกแล้ว')
  return (
    <Modal
      open
      onClose={onClose}
      title="แก้ไขโปรไฟล์"
      footer={
        <button className="btn-primary ml-auto" disabled={!name.trim()} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>
          บันทึก
        </button>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label">ชื่อที่แสดง</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">ตำแหน่ง</label>
          <input className="input" placeholder="เช่น Graphic Designer" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}

// ─── Projects ────────────────────────────────────────────────────────────────
function Projects() {
  const { projects } = useLookups()
  const [edit, setEdit] = useState<Partial<Project> | null>(null)
  const save = useMutate((p: Partial<Project> & { name: string }) => api.saveProject(p), [[...keys.projects]], 'บันทึกโปรเจกต์แล้ว')
  const del = useMutate((id: string) => api.deleteProject(id), [[...keys.projects], [...keys.tasks]], 'ลบโปรเจกต์แล้ว')
  const active = projects.filter((p) => !p.archived)
  const archived = projects.filter((p) => p.archived)

  const row = (p: Project) => (
    <li key={p.id} className="flex items-center gap-3 px-4 py-3">
      <span className="h-4 w-4 shrink-0 rounded-md" style={{ background: p.color }} />
      <div className="min-w-0 flex-1">
        <div className={cn('truncate font-semibold', p.archived && 'text-muted')}>{p.name}</div>
        {p.client && <div className="truncate text-xs text-muted">{p.client}</div>}
      </div>
      <button className="icon-btn" onClick={() => setEdit(p)} aria-label="แก้ไข">
        <Pencil size={15} />
      </button>
      <button className="icon-btn" title={p.archived ? 'นำกลับมาใช้' : 'เก็บเข้าคลัง'} onClick={() => save.mutate({ ...p, archived: !p.archived })}>
        {p.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
      </button>
      <button className="icon-btn hover:text-danger" onClick={() => confirm(`ลบโปรเจกต์ "${p.name}"? งานในโปรเจกต์จะไม่ถูกลบ`) && del.mutate(p.id)} aria-label="ลบ">
        <Trash2 size={15} />
      </button>
    </li>
  )

  return (
    <div className="space-y-4">
      <button className="btn-primary" onClick={() => setEdit({ name: '', color: PROJECT_COLORS[projects.length % PROJECT_COLORS.length] })}>
        <Plus size={16} /> โปรเจกต์ใหม่
      </button>
      <ul className="card divide-y divide-line">{active.length ? active.map(row) : <li className="p-6 text-center text-sm text-muted">ยังไม่มีโปรเจกต์</li>}</ul>
      {archived.length > 0 && (
        <>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">เก็บเข้าคลังแล้ว</h3>
          <ul className="card divide-y divide-line">{archived.map(row)}</ul>
        </>
      )}
      {edit && (
        <Modal
          open
          onClose={() => setEdit(null)}
          title={edit.id ? 'แก้ไขโปรเจกต์' : 'โปรเจกต์ใหม่'}
          footer={
            <button
              className="btn-primary ml-auto"
              disabled={!edit.name?.trim()}
              onClick={() => save.mutate({ ...edit, name: edit.name!.trim(), client: edit.client?.trim() || null }, { onSuccess: () => setEdit(null) })}
            >
              บันทึก
            </button>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="label">ชื่อโปรเจกต์</label>
              <input autoFocus className="input" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </div>
            <div>
              <label className="label">ลูกค้า (ไม่บังคับ)</label>
              <input className="input" value={edit.client ?? ''} onChange={(e) => setEdit({ ...edit, client: e.target.value })} />
            </div>
            <div>
              <label className="label">สี</label>
              <div className="flex flex-wrap gap-2">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setEdit({ ...edit, color: c })}
                    className={cn('h-8 w-8 rounded-xl ring-offset-2 ring-offset-surface', edit.color === c && 'ring-2 ring-ink')}
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Task types ──────────────────────────────────────────────────────────────
function Types() {
  const { types } = useLookups()
  const [emoji, setEmoji] = useState('✨')
  const [name, setName] = useState('')
  const save = useMutate((t: Partial<TaskType> & { name: string }) => api.saveType(t), [[...keys.types]])
  const del = useMutate((id: string) => api.deleteType(id), [[...keys.types], [...keys.tasks]], 'ลบประเภทงานแล้ว')
  return (
    <div className="space-y-4">
      <form
        className="card flex gap-2 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          save.mutate({ name: name.trim(), emoji: emoji || '✨', sort: types.length + 1 })
          setName('')
        }}
      >
        <input className="input w-14 text-center" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} aria-label="อีโมจิ" />
        <input className="input flex-1" placeholder="ชื่อประเภทงานใหม่ เช่น Illustration" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary h-10" disabled={!name.trim()}>
          <Plus size={16} /> เพิ่ม
        </button>
      </form>
      <ul className="card divide-y divide-line">
        {types.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-7 text-center text-lg">{t.emoji}</span>
            <span className="flex-1 font-semibold">{t.name}</span>
            <button className="icon-btn hover:text-danger" onClick={() => confirm(`ลบประเภท "${t.name}"?`) && del.mutate(t.id)} aria-label="ลบ">
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
