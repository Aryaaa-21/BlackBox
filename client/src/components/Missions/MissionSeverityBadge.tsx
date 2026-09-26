import React from 'react';
import { Shield, AlertCircle, AlertTriangle, ShieldAlert } from 'lucide-react';
import { MissionSeverity } from '../../types';

interface MissionSeverityBadgeProps {
  severity: MissionSeverity;
  size?: 'sm' | 'md' | 'lg';
}

export const MissionSeverityBadge: React.FC<MissionSeverityBadgeProps> = ({
  severity,
  size = 'md',
}) => {
  const config = {
    LOW: {
      label: 'LOW',
      icon: Shield,
      classes: 'bg-zinc-800/60 text-zinc-300 border-zinc-700/60',
      iconClasses: 'text-zinc-400',
    },
    MEDIUM: {
      label: 'MEDIUM',
      icon: AlertCircle,
      classes: 'bg-amber-950/40 text-amber-300 border-amber-800/60',
      iconClasses: 'text-amber-400',
    },
    HIGH: {
      label: 'HIGH',
      icon: AlertTriangle,
      classes: 'bg-orange-950/50 text-orange-300 border-orange-700/60',
      iconClasses: 'text-orange-400',
    },
    CRITICAL: {
      label: 'CRITICAL',
      icon: ShieldAlert,
      classes: 'bg-red-950/60 text-red-300 border-red-700 shadow-[0_0_10px_rgba(239,68,68,0.25)] font-bold',
      iconClasses: 'text-red-400',
    },
  }[severity];

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
      className={`inline-flex items-center font-mono rounded-md border tracking-wider uppercase transition-colors ${config.classes} ${sizeClasses}`}
      title={`Mission Severity: ${config.label}`}
    >
      <Icon className={`${iconSizes} ${config.iconClasses} shrink-0`} />
      <span>{config.label}</span>
    </span>
  );
};
