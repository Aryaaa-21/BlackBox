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
      classes: 'bg-blackbox-panel text-blackbox-textSecondary border-blackbox-border',
      iconClasses: 'text-blackbox-muted',
    },
    ACTIVE: {
      label: 'ACTIVE',
      icon: Radio,
      classes: 'bg-blackbox-cyan/15 text-blackbox-cyan border-blackbox-cyan/50',
      iconClasses: 'text-blackbox-cyan animate-pulse',
    },
    COMPLETED: {
      label: 'COMPLETED',
      icon: CheckCircle2,
      classes: 'bg-blackbox-cyan/20 text-blackbox-info border-blackbox-cyan/55',
      iconClasses: 'text-blackbox-info',
    },
    CANCELLED: {
      label: 'CANCELLED',
      icon: XCircle,
      classes: 'bg-blackbox-critical/25 text-blackbox-textSecondary border-blackbox-critical/70',
      iconClasses: 'text-blackbox-critical',
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
