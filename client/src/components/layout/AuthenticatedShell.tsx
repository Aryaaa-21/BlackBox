import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useConnectivityStore } from '../../stores/connectivity.store'
import { WifiOff } from 'lucide-react'

export function AuthenticatedShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const browser = useConnectivityStore((state) => state.browser)
  const api = useConnectivityStore((state) => state.api)
  const offline = browser === 'offline' || api === 'unreachable'
  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-shell__main">
        <Topbar onMenu={() => setSidebarOpen(true)} />
        {offline ? <div className="offline-banner"><WifiOff size={15} /><span>Offline. Changes are being stored locally and will sync when connectivity returns.</span></div> : null}
        <main className="app-shell__content"><Outlet /></main>
      </div>
    </div>
  )
}
