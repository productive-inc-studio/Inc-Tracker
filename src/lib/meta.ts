import type { Priority, Role, Status } from './types'

export const STATUSES: { id: Status; label: string; dot: string; tint: string }[] = [
  { id: 'todo', label: 'To Do', dot: 'bg-muted', tint: 'bg-sunken text-muted' },
  { id: 'in_progress', label: 'กำลังทำ', dot: 'bg-info', tint: 'bg-info/10 text-info' },
  { id: 'review', label: 'รอตรวจ', dot: 'bg-warn', tint: 'bg-warn/15 text-warn' },
  { id: 'done', label: 'เสร็จแล้ว', dot: 'bg-ok', tint: 'bg-ok/10 text-ok' },
]
export const statusMeta = (s: Status) => STATUSES.find((x) => x.id === s)!

export const PRIORITIES: { id: Priority; label: string; color: string; tint: string }[] = [
  { id: 'urgent', label: 'ด่วนมาก', color: 'text-danger', tint: 'bg-danger/10 text-danger' },
  { id: 'high', label: 'สูง', color: 'text-warn', tint: 'bg-warn/15 text-warn' },
  { id: 'normal', label: 'ปกติ', color: 'text-info', tint: 'bg-info/10 text-info' },
  { id: 'low', label: 'ต่ำ', color: 'text-muted', tint: 'bg-sunken text-muted' },
]
export const priorityMeta = (p: Priority) => PRIORITIES.find((x) => x.id === p)!

export const ROLES: { id: Role; label: string; desc: string }[] = [
  { id: 'admin', label: 'Admin', desc: 'เห็นและแก้ได้ทุกอย่าง จัดการสมาชิก' },
  { id: 'lead', label: 'Lead', desc: 'เห็นงานทั้งทีม มอบหมายงาน ดู KPI ทีม' },
  { id: 'member', label: 'Member', desc: 'เห็นงานของตัวเองและ KPI ตัวเอง' },
  { id: 'pending', label: 'รออนุมัติ', desc: 'ยังเข้าใช้งานไม่ได้' },
]
export const roleMeta = (r: Role) => ROLES.find((x) => x.id === r)!

export const ESTIMATE_PRESETS = [
  { label: '30น', minutes: 30 },
  { label: '1ชม', minutes: 60 },
  { label: '2ชม', minutes: 120 },
  { label: 'ครึ่งวัน', minutes: 240 },
  { label: '1 วัน', minutes: 480 },
  { label: '2 วัน', minutes: 960 },
]

export const PROJECT_COLORS = ['#6D4AFF', '#FF5C8A', '#FF8A3D', '#F5C400', '#2BC48A', '#22B8CF', '#3D7BFF', '#9AA0AE']
