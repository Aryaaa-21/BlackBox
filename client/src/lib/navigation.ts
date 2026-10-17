import {
  LayoutDashboard,
  PlayCircle,
  Settings,
  Shield,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavigationItem = {
  label: string
  to: string
  icon: LucideIcon
}

export const primaryNavigation: NavigationItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Missions', to: '/missions', icon: Shield },
  { label: 'Replay', to: '/replay', icon: PlayCircle },
]

export const secondaryNavigation: NavigationItem[] = [
  { label: 'Settings', to: '/settings', icon: Settings },
]
