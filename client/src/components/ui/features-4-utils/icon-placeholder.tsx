import * as React from "react"
import * as LucideIcons from "lucide-react"

export interface IconPlaceholderProps extends React.SVGProps<SVGSVGElement> {
  lucide?: string
  tabler?: string
  hugeicons?: string
  phosphor?: string
  remixicon?: string
  size?: number | string
  className?: string
  [key: string]: any
}

export function IconPlaceholder({
  lucide,
  size,
  className,
  tabler: _t,
  hugeicons: _h,
  phosphor: _p,
  remixicon: _r,
  ...props
}: IconPlaceholderProps) {
  const IconComponent =
    (lucide && (LucideIcons as Record<string, any>)[lucide]) ||
    LucideIcons.Sparkles

  return (
    <IconComponent
      {...(size ? { size } : {})}
      className={className}
      {...props}
    />
  )
}
