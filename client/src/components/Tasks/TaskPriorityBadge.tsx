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
      classes: 'bg-zinc-900 text-zinc-400 border-zinc-700/70',
    },
    MEDIUM: {
      label: 'MEDIUM',
      icon: ArrowUp,
      classes: 'bg-blue-950/40 text-blue-400 border-blue-800/60',
    },
    HIGH: {
      label: 'HIGH',
      icon: Flame,
      classes: 'bg-amber-950/50 text-amber-400 border-amber-800/80',
    },
    CRITICAL: {
      label: 'CRITICAL',
      icon: AlertCircle,
      classes: 'bg-rose-950/60 text-rose-300 border-rose-800 shadow-[0_0_8px_rgba(244,63,94,0.2)]',
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
