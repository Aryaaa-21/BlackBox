import React, { useEffect, useRef } from 'react';
import { AlertTriangle, AlertCircle, CheckCircle2, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary' | 'success';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm Action',
  cancelLabel = 'Cancel',
  variant = 'primary',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;
      if (event.key === 'Escape' && !isLoading) {
        onCancel();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      confirmButtonRef.current?.focus();
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  const variantConfig = {
    danger: {
      icon: AlertTriangle,
      iconClass: 'text-rose-400',
      iconBg: 'bg-rose-950/60 border-rose-800',
      buttonClass:
        'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 focus:ring-rose-500',
    },
    warning: {
      icon: AlertCircle,
      iconClass: 'text-amber-400',
      iconBg: 'bg-amber-950/60 border-amber-800',
      buttonClass:
        'bg-amber-600 hover:bg-amber-500 text-black font-semibold border-amber-500 focus:ring-amber-500',
    },
    success: {
      icon: CheckCircle2,
      iconClass: 'text-emerald-400',
      iconBg: 'bg-emerald-950/60 border-emerald-800',
      buttonClass:
        'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 focus:ring-emerald-500',
    },
    primary: {
      icon: CheckCircle2,
      iconClass: 'text-blackbox-cyan',
      iconBg: 'bg-cyan-950/60 border-cyan-800',
      buttonClass:
        'bg-blackbox-cyan hover:bg-cyan-300 text-black font-semibold border-cyan-400 focus:ring-cyan-400',
    },
  }[variant];

  const Icon = variantConfig.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md bg-blackbox-surface border border-blackbox-border rounded-xl shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150"
      >
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-blackbox-muted hover:text-blackbox-text hover:bg-blackbox-panel transition-colors disabled:opacity-50"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${variantConfig.iconBg}`}
          >
            <Icon className={`w-5 h-5 ${variantConfig.iconClass}`} />
          </div>

          <div className="flex-1 min-w-0">
            <h3
              id="confirm-dialog-title"
              className="text-base font-mono font-bold text-blackbox-text"
            >
              {title}
            </h3>
            <p className="mt-2 text-xs text-blackbox-textSecondary leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-blackbox-border/80">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg bg-blackbox-panel hover:bg-zinc-800 border border-blackbox-border text-xs font-mono text-blackbox-text transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg text-xs font-mono border transition-all flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-blackbox-bg disabled:opacity-50 ${variantConfig.buttonClass}`}
          >
            {isLoading && (
              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
