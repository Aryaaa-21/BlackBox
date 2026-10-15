import React from 'react';
import { AlertCircle, Flame, ArrowUp, ArrowDown } from 'lucide-react';
import { TaskPriority } from '../../types';

interface TaskPriorityBadgeProps {
  priority: TaskPriority;
  size?: 'sm' | 'md';
}

export const TaskPriorityBadge: React.FC<TaskPriorityBadgeProps> = ({ priority, size = 'sm' }) => {
  const config = {
    LOW: {
      label: 'LOW',
      icon: ArrowDown,
      classes: 'bg-blackbox-panel text-blackbox-muted border-blackbox-border',
    },
    MEDIUM: {
      label: 'MEDIUM',
      icon: ArrowUp,
      classes: 'bg-blackbox-cyan/10 text-blackbox-cyan border-blackbox-cyan/45',
    },
    HIGH: {
      label: 'HIGH',
      icon: Flame,
      classes: 'bg-blackbox-critical/16 text-blackbox-warning border-blackbox-critical/60',
    },
    CRITICAL: {
      label: 'CRITICAL',
      icon: AlertCircle,
      classes: 'bg-blackbox-critical/25 text-blackbox-textSecondary border-blackbox-critical',
    },
  }[priority];

  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono font-bold tracking-wider rounded border ${sizeClasses} ${config.classes}`}
    >
      <Icon className={iconSize} />
      <span>{config.label}</span>
    </span>
  );
};
