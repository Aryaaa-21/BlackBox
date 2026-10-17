import { Box } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

export function BrandMark({ compact = false, link = true }: { compact?: boolean; link?: boolean }) {
  const content = (
    <span className={cn('brand-mark', compact && 'brand-mark--compact')}>
      <span className="brand-mark__symbol"><Box size={18} strokeWidth={2.2} /></span>
      {!compact ? <span className="brand-mark__word">BLACKBOX</span> : null}
    </span>
  )
  return link ? <Link to="/" aria-label="BlackBox home">{content}</Link> : content
}
