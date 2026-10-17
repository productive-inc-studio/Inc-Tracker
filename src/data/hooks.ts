import { useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Api } from './api'
import { supabaseApi } from './supabase'
import { demoApi } from './demo'
import type { Member, Task, TaskInput } from '../lib/types'
import { useToast } from '../components/Toast'

export const DEMO = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo')
export const api: Api = DEMO ? demoApi : supabaseApi

export const keys = {
  me: ['me'] as const,
  members: ['members'] as const,
  invites: ['invites'] as const,
  projects: ['projects'] as const,
  types: ['types'] as const,
  tasks: ['tasks'] as const,
  running: ['running'] as const,
  time: (from: string, to: string) => ['time', from, to] as const,
  taskTime: (id: string) => ['time', 'task', id] as const,
  comments: (id: string) => ['comments', id] as const,
}

export const useMembers = () => useQuery({ queryKey: keys.members, queryFn: api.listMembers })
export const useProjects = () => useQuery({ queryKey: keys.projects, queryFn: api.listProjects })
export const useTypes = () => useQuery({ queryKey: keys.types, queryFn: api.listTypes })
export const useTasks = () => useQuery({ queryKey: keys.tasks, queryFn: api.listTasks })
export const useRunning = () => useQuery({ queryKey: keys.running, queryFn: api.runningTimer })
export const useTimeRange = (from: string, to: string) =>
  useQuery({ queryKey: keys.time(from, to), queryFn: () => api.listTimeEntries(from, to) })
export const useTaskTime = (id: string) => useQuery({ queryKey: keys.taskTime(id), queryFn: () => api.listTaskTime(id) })
export const useComments = (id: string) => useQuery({ queryKey: keys.comments(id), queryFn: () => api.listComments(id) })

/** Lookup maps used all over the UI. */
export function useLookups() {
  const members = useMembers().data ?? []
  const projects = useProjects().data ?? []
  const types = useTypes().data ?? []
  return useMemo(
    () => ({
      members,
      projects,
      types,
      member: (id: string | null) => (id ? members.find((m) => m.id === id) : undefined) as Member | undefined,
      project: (id: string | null) => (id ? projects.find((p) => p.id === id) : undefined),
      type: (id: string | null) => (id ? types.find((t) => t.id === id) : undefined),
    }),
    [members, projects, types],
  )
}

/** Refetch whatever changed when another teammate edits something. */
export function useLiveUpdates() {
  const qc = useQueryClient()
  useEffect(
    () =>
      api.subscribe((table) => {
        if (table === 'tasks') qc.invalidateQueries({ queryKey: keys.tasks })
        if (table === 'time') {
          qc.invalidateQueries({ queryKey: ['time'] })
          qc.invalidateQueries({ queryKey: keys.running })
        }
        if (table === 'comments') qc.invalidateQueries({ queryKey: ['comments'] })
      }),
    [qc],
  )
}

export function useTaskActions() {
  const qc = useQueryClient()
  const toast = useToast()
  const onError = (e: Error) => {
    toast(e.message, 'error')
    qc.invalidateQueries({ queryKey: keys.tasks })
  }

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TaskInput }) => api.updateTask(id, patch),
    onMutate: ({ id, patch }) => {
      // optimistic: board drags and status flips feel instant
      qc.setQueryData<Task[]>(keys.tasks, (old) =>
        old?.map((t) =>
          t.id === id
            ? { ...t, ...patch, completed_at: patch.status === 'done' ? t.completed_at ?? new Date().toISOString() : patch.status ? null : t.completed_at }
            : t,
        ),
      )
    },
    onError,
    onSettled: () => qc.invalidateQueries({ queryKey: keys.tasks }),
  })

  const create = useMutation({
    mutationFn: (input: TaskInput & { title: string }) => api.createTask(input),
    onSuccess: (t) => qc.setQueryData<Task[]>(keys.tasks, (old) => [...(old ?? []), t]),
    onError,
    onSettled: () => qc.invalidateQueries({ queryKey: keys.tasks }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onMutate: (id) => qc.setQueryData<Task[]>(keys.tasks, (old) => old?.filter((t) => t.id !== id)),
    onError,
    onSuccess: () => toast('ลบงานแล้ว'),
  })

  return {
    update: (id: string, patch: TaskInput) => update.mutate({ id, patch }),
    create: create.mutateAsync,
    remove: remove.mutate,
    creating: create.isPending,
  }
}

export function useTimerActions() {
  const qc = useQueryClient()
  const toast = useToast()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: keys.running })
    qc.invalidateQueries({ queryKey: ['time'] })
    qc.invalidateQueries({ queryKey: keys.tasks })
  }
  const fail = (e: Error) => toast(e.message, 'error')
  const start = useMutation({ mutationFn: api.startTimer, onSuccess: refresh, onError: fail })
  const stop = useMutation({ mutationFn: api.stopTimer, onSuccess: refresh, onError: fail })
  const add = useMutation({
    mutationFn: (v: { taskId: string; startedAt: string; minutes: number; note?: string }) =>
      api.addTime(v.taskId, v.startedAt, v.minutes, v.note),
    onSuccess: () => {
      refresh()
      toast('บันทึกเวลาแล้ว')
    },
    onError: fail,
  })
  const del = useMutation({ mutationFn: api.deleteTime, onSuccess: refresh, onError: fail })
  return { start: start.mutate, stop: stop.mutate, add: add.mutate, del: del.mutate, busy: start.isPending || stop.isPending }
}
