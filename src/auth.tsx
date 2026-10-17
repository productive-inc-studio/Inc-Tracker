import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './data/supabase'
import { DEMO, api, keys } from './data/hooks'
import type { Member } from './lib/types'

interface AuthState {
  me: Member
  isAdmin: boolean
  isManager: boolean
}
const Ctx = createContext<AuthState | null>(null)

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside AuthGate')
  return v
}

type Phase = { kind: 'loading' } | { kind: 'signed-out' } | { kind: 'signed-in'; session: Session | null }

function useSessionPhase(): Phase {
  const [phase, setPhase] = useState<Phase>(DEMO ? { kind: 'signed-in', session: null } : { kind: 'loading' })
  useEffect(() => {
    if (DEMO) return
    supabase.auth.getSession().then(({ data }) =>
      setPhase(data.session ? { kind: 'signed-in', session: data.session } : { kind: 'signed-out' }),
    )
    const { data } = supabase.auth.onAuthStateChange((_e, session) =>
      setPhase(session ? { kind: 'signed-in', session } : { kind: 'signed-out' }),
    )
    return () => data.subscription.unsubscribe()
  }, [])
  return phase
}

export function AuthGate({
  loading,
  signedOut,
  pending,
  failed,
  children,
}: {
  loading: ReactNode
  signedOut: ReactNode
  pending: (me: Member) => ReactNode
  failed: (message: string) => ReactNode
  children: ReactNode
}) {
  const phase = useSessionPhase()
  const qc = useQueryClient()
  const userId = phase.kind === 'signed-in' ? phase.session?.user.id ?? 'demo' : null
  const me = useQuery({
    queryKey: [...keys.me, userId],
    queryFn: api.ensureMember,
    enabled: !!userId,
    retry: false,
    // a pending member keeps checking whether an admin has approved them
    refetchInterval: (q) => (q.state.data?.role === 'pending' ? 15_000 : false),
  })

  useEffect(() => {
    if (phase.kind === 'signed-out') qc.clear()
  }, [phase.kind, qc])

  if (phase.kind === 'loading') return <>{loading}</>
  if (phase.kind === 'signed-out') return <>{signedOut}</>
  if (me.isError) return <>{failed(me.error.message)}</>
  if (!me.data) return <>{loading}</>
  if (me.data.role === 'pending') return <>{pending(me.data)}</>

  const value: AuthState = {
    me: me.data,
    isAdmin: me.data.role === 'admin',
    isManager: me.data.role === 'admin' || me.data.role === 'lead',
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
