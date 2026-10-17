import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthenticatedShell } from './components/layout/AuthenticatedShell'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { useAuthStore } from './stores/auth.store'
import { useConnectivityStore } from './stores/connectivity.store'
import { useRealtimeStore } from './stores/realtime.store'
import { useSyncStore } from './stores/sync.store'
import { useOperationsStore } from './stores/operations.store'
import { LoadingState } from './components/ui'
import { ShaderBackground } from './components/ui/ethereal-whispers'
import MotionBlurDemo from './components/ui/demo'
import ModernLoginSignupDemo from './components/ui/modern-login-signup-demo'

const DashboardPage = lazy(async () => ({ default: (await import('./pages/app/DashboardPage')).DashboardPage }))
const MissionDetailPage = lazy(async () => ({ default: (await import('./pages/app/MissionDetailPage')).MissionDetailPage }))
const MissionReplayPage = lazy(async () => ({ default: (await import('./pages/app/MissionReplayPage')).MissionReplayPage }))
const MissionsPage = lazy(async () => ({ default: (await import('./pages/app/MissionsPage')).MissionsPage }))
const SettingsPage = lazy(async () => ({ default: (await import('./pages/app/SettingsPage')).SettingsPage }))
const NotFoundPage = lazy(async () => ({ default: (await import('./pages/NotFoundPage')).NotFoundPage }))

function Bootstrap() {
  const loadCurrentUser = useAuthStore((state) => state.loadCurrentUser)
  const user = useAuthStore((state) => state.user)
  const initialized = useAuthStore((state) => state.initialized)
  const startConnectivity = useConnectivityStore((state) => state.start)
  const connectRealtime = useRealtimeStore((state) => state.connect)
  const disconnectRealtime = useRealtimeStore((state) => state.disconnect)
  const api = useConnectivityStore((state) => state.api)
  const browser = useConnectivityStore((state) => state.browser)
  const sync = useSyncStore((state) => state.sync)
  const refreshPending = useSyncStore((state) => state.refreshPendingCount)
  const hydrateCache = useOperationsStore((state) => state.hydrateCache)
  const observeCache = useOperationsStore((state) => state.observeCache)
  const observeQueue = useSyncStore((state) => state.observeQueue)

  useEffect(() => { void loadCurrentUser(); return startConnectivity(); }, [loadCurrentUser, startConnectivity])
  useEffect(() => {
    if (user) connectRealtime()
    else disconnectRealtime()
    return () => { if (!user) disconnectRealtime() }
  }, [user, connectRealtime, disconnectRealtime])
  useEffect(() => { void refreshPending() }, [refreshPending])
  useEffect(() => observeQueue(), [observeQueue])
  useEffect(() => {
    useOperationsStore.getState().reset()
    if (user) return observeCache()
  }, [user?.id, observeCache])
  useEffect(() => { if (user) void hydrateCache() }, [hydrateCache, user?.id])
  useEffect(() => {
    if (!user || api !== 'reachable' || browser === 'offline') return
    const run = () => { void sync().catch(() => undefined) }
    run()
    const timer = setInterval(run, 10_000)
    return () => clearInterval(timer)
  }, [api, browser, user?.id, sync])

  if (!initialized) return <div className="boot-screen"><LoadingState label="Opening operations console" /></div>
  return <Suspense fallback={<div className="boot-screen"><LoadingState label="Loading workspace" /></div>}><RoutesWithGuards /></Suspense>
}

function ProtectedRoute() {
  const user = useAuthStore((state) => state.user)
  const initialized = useAuthStore((state) => state.initialized)
  const location = useLocation()
  if (!initialized) return <div className="boot-screen"><LoadingState label="Checking session" /></div>
  const next = `${location.pathname}${location.search}${location.hash}`
  return user ? <AuthenticatedShell /> : <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
}

function PublicOnly({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user)
  return user ? <Navigate to="/dashboard" replace /> : children
}

function RoutesWithGuards() {
  return <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/demo/motion-blur" element={<MotionBlurDemo />} />
    <Route path="/demo/login" element={<ModernLoginSignupDemo />} />
    <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
    <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
    <Route element={<ProtectedRoute />}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/missions" element={<MissionsPage />} />
      <Route path="/missions/:missionId" element={<MissionDetailPage />} />
      <Route path="/missions/:missionId/replay" element={<MissionReplayPage />} />
      <Route path="/replay" element={<MissionReplayPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
}

export default function App() {
  return <div className="app-root"><ShaderBackground className="global-shader" /><div className="app-root__content"><Bootstrap /></div></div>
}
