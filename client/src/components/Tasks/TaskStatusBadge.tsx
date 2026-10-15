import React from 'react';
import { Clock, Play, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { TaskStatus } from '../../types';

interface TaskStatusBadgeProps {
  status: TaskStatus;
  size?: 'sm' | 'md';
}

export const TaskStatusBadge: React.FC<TaskStatusBadgeProps> = ({ status, size = 'sm' }) => {
  const config = {
    PENDING: {
      label: 'PENDING',
      icon: Clock,
      classes: 'bg-blackbox-panel text-blackbox-muted border-blackbox-border',
    },
    ACTIVE: {
      label: 'ACTIVE',
      icon: Play,
      classes: 'bg-blackbox-cyan/15 text-blackbox-cyan border-blackbox-cyan/55',
    },
    BLOCKED: {
      label: 'BLOCKED',
      icon: AlertOctagon,
      classes: 'bg-blackbox-critical/20 text-blackbox-warning border-blackbox-critical/65',
    },
    COMPLETED: {
      label: 'COMPLETED',
      icon: CheckCircle2,
      classes: 'bg-blackbox-cyan/20 text-blackbox-info border-blackbox-cyan/60',
    },
  }[status];

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
