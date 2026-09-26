import React, { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ElementType;
  title?: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title = 'No Records Found',
  description = 'No operational entities match the current criteria.',
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-blackbox-border rounded-xl bg-blackbox-surface/40 my-4">
      <div className="w-12 h-12 rounded-lg bg-blackbox-panel border border-blackbox-border flex items-center justify-center mb-4 text-blackbox-muted">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-medium text-blackbox-text font-mono mb-1">{title}</h3>
      <p className="text-xs text-blackbox-muted max-w-sm mb-5 leading-relaxed">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};
