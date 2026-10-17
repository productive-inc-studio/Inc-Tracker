export type Role = 'admin' | 'lead' | 'member' | 'pending'
export type Status = 'todo' | 'in_progress' | 'review' | 'done'
export type Priority = 'urgent' | 'high' | 'normal' | 'low'

export interface Member {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  title: string | null
  role: Role
  created_at: string
}

export interface Invite {
  email: string
  role: Exclude<Role, 'pending'>
  created_at: string
}

export interface Project {
  id: string
  name: string
  client: string | null
  color: string
  archived: boolean
}

export interface TaskType {
  id: string
  name: string
  emoji: string
  sort: number
}

export interface Task {
  id: string
  title: string
  description: string
  status: Status
  priority: Priority
  project_id: string | null
  type_id: string | null
  assignee_id: string | null
  created_by: string | null
  start_date: string | null
  due_date: string | null
  estimate_minutes: number | null
  tracked_minutes: number
  completed_at: string | null
  position: number
  created_at: string
  updated_at: string
}

export type TaskInput = Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'tracked_minutes' | 'completed_at'>>

export interface TimeEntry {
  id: string
  task_id: string
  member_id: string
  started_at: string
  ended_at: string | null
  minutes: number | null
  note: string | null
}

export interface Comment {
  id: string
  task_id: string
  member_id: string
  body: string
  created_at: string
}
