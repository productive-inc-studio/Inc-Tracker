import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '../lib/utils'

type Kind = 'ok' | 'error'
const Ctx = createContext<(msg: string, kind?: Kind) => void>(() => {})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: Kind }[]>([])
  const push = useCallback((msg: string, kind: Kind = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x, { id, msg, kind }])
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), kind === 'error' ? 5000 : 2500)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed z-[100] left-1/2 -translate-x-1/2 bottom-24 md:bottom-6 flex flex-col gap-2 items-center pointer-events-none w-[calc(100%-32px)] max-w-sm">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              'animate-slide-up pointer-events-auto flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium shadow-pop',
              t.kind === 'error' ? 'bg-danger text-white' : 'bg-ink text-surface',
            )}
          >
            {t.kind === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} className="text-pop" />}
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
