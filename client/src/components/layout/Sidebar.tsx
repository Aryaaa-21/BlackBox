import { X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { BrandMark } from '../brand/BrandMark'
import { IconButton } from '../ui'
import { cn } from '../../lib/cn'
import { primaryNavigation, secondaryNavigation } from '../../lib/navigation'

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <button className={cn('sidebar-backdrop', open && 'sidebar-backdrop--visible')} onClick={onClose} aria-label="Close navigation" />
      <aside className={cn('sidebar', open && 'sidebar--open')} aria-label="Primary navigation">
        <div className="sidebar__top">
          <BrandMark link={false} />
          <IconButton label="Close navigation" className="sidebar__close" onClick={onClose}><X size={18} /></IconButton>
        </div>
        <div className="sidebar__workspace">
          <span className="sidebar__workspace-mark">W</span>
          <div><strong>Workspace</strong><span>Foundation shell</span></div>
        </div>
        <nav className="sidebar__nav">
          <span className="sidebar__label">Workspace</span>
          {primaryNavigation.map(({ label, to, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={onClose} className={({ isActive }) => cn('sidebar__link', isActive && 'sidebar__link--active')}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
            </NavLink>
          ))}
          <span className="sidebar__label sidebar__label--secondary">System</span>
          {secondaryNavigation.map(({ label, to, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={onClose} className={({ isActive }) => cn('sidebar__link', isActive && 'sidebar__link--active')}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__footer">
          <span className="sidebar__footer-line" />
          <span className="mono">CLIENT FOUNDATION / 01</span>
        </div>
      </aside>
    </>
  )
}
