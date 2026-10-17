import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './auth'
import { Layout } from './components/Layout'
import { ToastProvider } from './components/Toast'
import { HomePage } from './pages/Home'
import { AuthErrorPage, FullLoader, LoginPage, PendingPage } from './pages/Login'
import { TasksPage } from './pages/Tasks'
import { TeamPage } from './pages/Team'
import { Spinner } from './components/ui'

const DashboardPage = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.DashboardPage })))

export function App() {
  return (
    <ToastProvider>
      <AuthGate
        loading={<FullLoader />}
        signedOut={<LoginPage />}
        pending={(me) => <PendingPage me={me} />}
        failed={(msg) => <AuthErrorPage message={msg} />}
      >
        <HashRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route
                path="/dashboard"
                element={
                  <Suspense fallback={<div className="grid place-items-center py-24"><Spinner /></div>}>
                    <DashboardPage />
                  </Suspense>
                }
              />
              <Route path="/team" element={<TeamPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </HashRouter>
      </AuthGate>
    </ToastProvider>
  )
}
