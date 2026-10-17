import { LogOut, Menu, ShieldCheck } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { IconButton, NetworkIndicator, SyncIndicator } from '../ui'
import { useAuthStore } from '../../stores/auth.store'
import { useConnectivityStore } from '../../stores/connectivity.store'
import { useRealtimeStore } from '../../stores/realtime.store'
import { useSyncStore } from '../../stores/sync.store'
import { useState } from 'react'

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/missions': 'Missions',
  '/replay': 'Mission replay',
  '/settings': 'Settings',
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const browser = useConnectivityStore((state) => state.browser)
  const api = useConnectivityStore((state) => state.api)
  const socketConnected = useRealtimeStore((state) => state.connected)
  const pendingCount = useSyncStore((state) => state.pendingCount)
  const failedCount = useSyncStore((state) => state.failedCount)
  const syncing = useSyncStore((state) => state.syncing)
  const conflicts = useSyncStore((state) => state.conflicts)
  const title = titles[location.pathname] ?? (location.pathname.includes('/replay') ? 'Mission replay' : location.pathname.includes('/missions/') ? 'Mission workspace' : 'Workspace')
  const connection = browser === 'offline' || api === 'unreachable' ? 'offline' : api === 'reachable' ? 'online' : 'unknown'
  const syncState = syncing ? 'syncing' : conflicts.length ? 'conflict' : failedCount ? 'failed' : pendingCount ? 'pending' : 'synced'
  const syncCount = pendingCount + failedCount + conflicts.length
  const initials = user?.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'BB'
  return (
    <header className="topbar">
      <div className="topbar__left">
        <IconButton label="Open navigation" className="topbar__menu" onClick={onMenu}><Menu size={19} /></IconButton>
        <div><span className="topbar__context">BlackBox workspace</span><h2>{title}</h2></div>
      </div>
      <div className="topbar__status">
        <NetworkIndicator state={connection} />
        <button className="sync-button" onClick={() => navigate('/settings')} aria-label="Open synchronization status"><SyncIndicator state={syncState} />{syncCount ? <span className="sync-button__count">{syncCount}</span> : null}</button>
        <span className="topbar__divider" />
        <div className="user-menu"><button className="topbar__user" onClick={() => setOpen((value) => !value)} aria-expanded={open}><span className="avatar">{initials}</span><span className="topbar__user-copy"><strong>{user?.name || 'Signed-in user'}</strong><small>{socketConnected ? 'Live socket' : user?.role || 'Session ready'}</small></span></button>{open ? <div className="user-menu__panel"><button onClick={() => navigate('/settings')}><ShieldCheck size={14} />&nbsp; Account settings</button><button onClick={async () => { await logout(); navigate('/login') }}><LogOut size={14} />&nbsp; Sign out</button></div> : null}</div>
      </div>
    </header>
  )
}
