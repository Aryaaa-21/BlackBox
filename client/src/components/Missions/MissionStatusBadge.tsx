import React from 'react';
import { FileEdit, Radio, CheckCircle2, XCircle } from 'lucide-react';
import { MissionStatus } from '../../types';

interface MissionStatusBadgeProps {
  status: MissionStatus;
  size?: 'sm' | 'md' | 'lg';
}

export const MissionStatusBadge: React.FC<MissionStatusBadgeProps> = ({
  status,
  size = 'md',
}) => {
  const config = {
    DRAFT: {
      label: 'DRAFT',
      icon: FileEdit,
      classes: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/80',
      iconClasses: 'text-zinc-400',
    },
    ACTIVE: {
      label: 'ACTIVE',
      icon: Radio,
      classes: 'bg-cyan-950/60 text-blackbox-cyan border-cyan-700/60 shadow-[0_0_8px_rgba(0,210,255,0.2)]',
      iconClasses: 'text-blackbox-cyan animate-pulse',
    },
    COMPLETED: {
      label: 'COMPLETED',
      icon: CheckCircle2,
      classes: 'bg-emerald-950/60 text-emerald-400 border-emerald-700/60',
      iconClasses: 'text-emerald-400',
    },
    CANCELLED: {
      label: 'CANCELLED',
      icon: XCircle,
      classes: 'bg-rose-950/60 text-rose-400 border-rose-800/60',
      iconClasses: 'text-rose-400',
    },
  }[status];

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  }[size];

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size];

  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center font-mono font-semibold rounded-md border tracking-wider uppercase transition-colors ${config.classes} ${sizeClasses}`}
      title={`Mission Status: ${config.label}`}
    >
      <Icon className={`${iconSizes} ${config.iconClasses} shrink-0`} />
      <span>{config.label}</span>
    </span>
  );
};
