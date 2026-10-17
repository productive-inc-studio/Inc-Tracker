import type { Comment, Invite, Member, Project, Subtask, SubtaskInput, Task, TaskInput, TaskType, TimeEntry } from '../lib/types'

export type LiveTable = 'tasks' | 'subtasks' | 'time' | 'comments'

/** Everything the UI needs from the backend. Implemented by Supabase (real) and an in-memory demo (dev only). */
export interface Api {
  ensureMember(): Promise<Member>
  signOut(): Promise<void>

  listMembers(): Promise<Member[]>
  updateMember(id: string, patch: Partial<Pick<Member, 'full_name' | 'title' | 'role'>>): Promise<void>
  removeMember(id: string): Promise<void>
  listInvites(): Promise<Invite[]>
  createInvite(email: string, role: Invite['role']): Promise<void>
  deleteInvite(email: string): Promise<void>

  listProjects(): Promise<Project[]>
  saveProject(p: Partial<Project> & { name: string }): Promise<void>
  deleteProject(id: string): Promise<void>
  listTypes(): Promise<TaskType[]>
  saveType(t: Partial<TaskType> & { name: string }): Promise<void>
  deleteType(id: string): Promise<void>

  listTasks(): Promise<Task[]>
  createTask(input: TaskInput & { title: string }): Promise<Task>
  updateTask(id: string, patch: TaskInput): Promise<void>
  deleteTask(id: string): Promise<void>

  /** Every subtask the current user can see. */
  listSubtasks(): Promise<Subtask[]>
  createSubtask(taskId: string, input: SubtaskInput & { title: string }): Promise<void>
  updateSubtask(id: string, patch: SubtaskInput): Promise<void>
  deleteSubtask(id: string): Promise<void>

  /** Entries that started in [from, to). */
  listTimeEntries(from: string, to: string): Promise<TimeEntry[]>
  listTaskTime(taskId: string): Promise<TimeEntry[]>
  runningTimer(): Promise<TimeEntry | null>
  startTimer(taskId: string): Promise<void>
  stopTimer(): Promise<void>
  addTime(taskId: string, startedAt: string, minutes: number, note?: string): Promise<void>
  deleteTime(id: string): Promise<void>

  listComments(taskId: string): Promise<Comment[]>
  addComment(taskId: string, body: string): Promise<void>
  deleteComment(id: string): Promise<void>

  /** Push a message to the studio LINE group via the edge function. */
  notifyLine(payload: { kind: 'summary' } | { kind: 'task'; task_id: string }): Promise<void>

  /** Subscribe to live changes; returns an unsubscribe function. */
  subscribe(onChange: (table: LiveTable) => void): () => void
}
