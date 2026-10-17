import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BrandMark } from '../brand/BrandMark'
import { Button } from '../ui'

export function PublicLayout({ children }: { children: ReactNode }) {
  return <div className="public-layout"><header className="public-layout__nav"><BrandMark /><nav className="public-layout__links" aria-label="Product navigation"><a href="#product">Product</a><a href="#operations">Operations</a><a href="#reliability">Reliability</a></nav><div className="public-layout__actions"><Link to="/login" className="public-nav-link">Sign in</Link><Link to="/dashboard"><Button variant="secondary">Open console</Button></Link></div></header>{children}</div>
}
