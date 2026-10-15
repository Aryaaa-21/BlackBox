import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  subtext?: string;
  fullScreen?: boolean;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Initializing BlackBox subsystem...',
  subtext,
  fullScreen = false,
}) => {
  const content = (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col items-center justify-center p-8 text-center space-y-3">
      <div className="relative">
        <Loader2 className="w-7 h-7 text-blackbox-cyan animate-spin" aria-hidden="true" />
      </div>
      <p className="text-sm text-blackbox-text font-medium">{message}</p>
      {subtext && <p className="text-xs text-blackbox-muted max-w-sm">{subtext}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-blackbox-bg flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return content;
};
