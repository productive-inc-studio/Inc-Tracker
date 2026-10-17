import { useEffect, useState } from 'react'
import { useAuth } from '../auth'
import { useSubtaskActions, useTaskActions } from '../data/hooks'
import type { TaskInput } from '../lib/types'
import { AssigneeField, DateField, EstimateField, PriorityField, ProjectField, StatusField, TypeField } from './fields'
import { Modal } from './ui'
import { DraftSubtasks } from './Subtasks'
import { useToast } from './Toast'

const blank = (me: string): TaskInput => ({
  title: '',
  description: '',
  status: 'todo',
  priority: 'normal',
  assignee_id: me,
  project_id: null,
  type_id: null,
  due_date: null,
  start_date: null,
  estimate_minutes: null,
})

export function NewTaskModal({ defaults, onClose }: { defaults: TaskInput | null; onClose: () => void }) {
  const { me } = useAuth()
  const { create, creating } = useTaskActions()
  const toast = useToast()
  const [form, setForm] = useState<TaskInput>(blank(me.id))
  const [subtasks, setSubtasks] = useState<string[]>([])
  const subtaskActions = useSubtaskActions()
  const set = (patch: TaskInput) => setForm((f) => ({ ...f, ...patch }))

  useEffect(() => {
    if (defaults) {
      setForm({ ...blank(me.id), ...defaults })
      setSubtasks([])
    }
  }, [defaults, me.id])

  const submit = async (again: boolean) => {
    const title = form.title?.trim()
    if (!title) return
    try {
      const task = await create({ ...form, title })
      for (const [i, t] of subtasks.entries())
        await subtaskActions.create(task.id, { title: t, assignee_id: form.assignee_id ?? null, position: i })
      toast(subtasks.length ? `สร้างงานพร้อม ${subtasks.length} ข้อย่อยแล้ว ✨` : 'สร้างงานแล้ว ✨')
      setSubtasks([])
      if (again) set({ title: '', description: '' })
      else onClose()
    } catch {
      /* toast already shown */
    }
  }

  return (
    <Modal
      open={!!defaults}
      onClose={onClose}
      title="สร้างงานใหม่"
      wide
      footer={
        <>
          <button className="btn-ghost hidden sm:inline-flex" onClick={() => submit(true)} disabled={creating || !form.title?.trim()}>
            สร้างแล้วเพิ่มต่อ
          </button>
          <button className="btn-primary ml-auto" onClick={() => submit(false)} disabled={creating || !form.title?.trim()}>
            สร้างงาน
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit(false)
        }}
      >
        <input
          autoFocus
          className="w-full bg-transparent text-xl font-bold outline-none placeholder:text-muted/60"
          placeholder="ชื่องาน เช่น Key visual แคมเปญหน้าร้อน"
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
        />
        <textarea
          className="mt-3 min-h-[90px] w-full resize-y rounded-xl bg-sunken p-3 text-sm outline-none placeholder:text-muted/70 focus:ring-4 focus:ring-brand/15"
          placeholder="Brief / รายละเอียด / ลิงก์ไฟล์อ้างอิง"
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        <StatusField value={form.status!} onChange={(status) => set({ status })} />
        <AssigneeField value={form.assignee_id ?? null} onChange={(assignee_id) => set({ assignee_id })} />
        <DateField value={form.due_date ?? null} onChange={(due_date) => set({ due_date })} placeholder="กำหนดส่ง" />
        <PriorityField value={form.priority!} onChange={(priority) => set({ priority })} />
        <ProjectField value={form.project_id ?? null} onChange={(project_id) => set({ project_id })} />
        <TypeField value={form.type_id ?? null} onChange={(type_id) => set({ type_id })} />
        <EstimateField value={form.estimate_minutes ?? null} onChange={(estimate_minutes) => set({ estimate_minutes })} />
      </div>
      <DraftSubtasks items={subtasks} onChange={setSubtasks} />
    </Modal>
  )
}
