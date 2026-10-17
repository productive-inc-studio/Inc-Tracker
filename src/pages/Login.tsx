import { useState } from 'react'
import { Clock3, LogOut, ShieldAlert } from 'lucide-react'
import { redirectError, signInWithGoogle } from '../data/supabase'
import { api } from '../data/hooks'
import type { Member } from '../lib/types'
import { Logo } from '../components/Logo'
import { Spinner } from '../components/ui'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-full place-items-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -top-40 -left-32 h-96 w-96 rounded-full bg-brand/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-pop/30 blur-3xl" />
      <div className="relative w-full max-w-sm">{children}</div>
    </div>
  )
}

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
)

export function LoginPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(redirectError ? `Login ไม่สำเร็จ: ${redirectError}` : '')
  const go = async () => {
    setBusy(true)
    setError('')
    const { error } = await signInWithGoogle()
    if (error) {
      setError(error.message)
      setBusy(false)
    }
  }
  return (
    <Shell>
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo size={56} />
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight">
          Work<span className="text-brand">Tracker</span>
        </h1>
        <p className="mt-2 text-muted">ติดตามงาน เวลา และ KPI ของทีม INC Studio</p>
      </div>
      <div className="card p-6">
        <button className="btn-outline h-12 w-full text-[15px]" onClick={go} disabled={busy}>
          {busy ? <Spinner /> : <GoogleIcon />}
          เข้าสู่ระบบด้วย Google
        </button>
        {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}
        <p className="mt-4 text-center text-xs text-muted">ใช้ได้เฉพาะบัญชีที่ Admin เชิญหรืออนุมัติแล้ว</p>
      </div>
      <p className="mt-4 text-center text-xs">
        <a href={`${import.meta.env.BASE_URL}privacy.html`} className="text-muted underline hover:text-ink">
          นโยบายความเป็นส่วนตัว
        </a>
      </p>
    </Shell>
  )
}

export function PendingPage({ me }: { me: Member }) {
  return (
    <Shell>
      <div className="card p-7 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-warn/15 text-warn">
          <Clock3 />
        </div>
        <h2 className="text-xl font-extrabold">รอ Admin อนุมัติ</h2>
        <p className="mt-2 text-sm text-muted">
          บัญชี <b className="text-ink">{me.email}</b> ยังไม่ได้รับสิทธิ์เข้าใช้งาน แจ้ง Admin ของทีมให้อนุมัติ แล้วหน้านี้จะเข้าระบบให้เองอัตโนมัติ
        </p>
        <button className="btn-ghost mt-5" onClick={() => api.signOut()}>
          <LogOut size={16} /> ใช้บัญชีอื่น
        </button>
      </div>
    </Shell>
  )
}

export function AuthErrorPage({ message }: { message: string }) {
  const googleOnly = message.includes('google_required')
  return (
    <Shell>
      <div className="card p-7 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-danger/10 text-danger">
          <ShieldAlert />
        </div>
        <h2 className="text-xl font-extrabold">{googleOnly ? 'ต้องเข้าด้วย Google' : 'เข้าสู่ระบบไม่สำเร็จ'}</h2>
        <p className="mt-2 text-sm text-muted">
          {googleOnly ? 'ระบบนี้รับเฉพาะบัญชีที่เข้าสู่ระบบด้วย Google' : message}
        </p>
        <button className="btn-primary mt-5" onClick={() => api.signOut()}>
          <LogOut size={16} /> ออกจากระบบแล้วลองใหม่
        </button>
      </div>
    </Shell>
  )
}

export function FullLoader() {
  return (
    <div className="grid min-h-full place-items-center">
      <div className="flex flex-col items-center gap-3">
        <Logo size={44} />
        <Spinner />
      </div>
    </div>
  )
}
