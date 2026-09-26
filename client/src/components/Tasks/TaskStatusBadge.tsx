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
      classes: 'bg-zinc-900 text-zinc-400 border-zinc-700/80',
    },
    ACTIVE: {
      label: 'ACTIVE',
      icon: Play,
      classes: 'bg-cyan-950/60 text-cyan-400 border-cyan-800/90 shadow-[0_0_8px_rgba(6,182,212,0.15)]',
    },
    BLOCKED: {
      label: 'BLOCKED',
      icon: AlertOctagon,
      classes: 'bg-amber-950/60 text-amber-400 border-amber-800/90 shadow-[0_0_8px_rgba(245,158,11,0.15)]',
    },
    COMPLETED: {
      label: 'COMPLETED',
      icon: CheckCircle2,
      classes: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/90 shadow-[0_0_8px_rgba(16,185,129,0.15)]',
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
