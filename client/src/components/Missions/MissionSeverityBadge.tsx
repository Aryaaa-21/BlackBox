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
      classes: 'bg-blackbox-panel text-blackbox-textSecondary border-blackbox-border',
      iconClasses: 'text-blackbox-muted',
    },
    MEDIUM: {
      label: 'MEDIUM',
      icon: AlertCircle,
      classes: 'bg-blackbox-cyan/10 text-blackbox-info border-blackbox-cyan/45',
      iconClasses: 'text-blackbox-info',
    },
    HIGH: {
      label: 'HIGH',
      icon: AlertTriangle,
      classes: 'bg-blackbox-critical/15 text-blackbox-textSecondary border-blackbox-critical/55',
      iconClasses: 'text-blackbox-warning',
    },
    CRITICAL: {
      label: 'CRITICAL',
      icon: ShieldAlert,
      classes: 'bg-blackbox-critical/25 text-blackbox-text border-blackbox-critical font-bold',
      iconClasses: 'text-blackbox-critical',
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
