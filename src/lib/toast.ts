import { toast as sonnerToast } from 'sonner';

// Keep track of recent toasts to prevent identical duplicates from firing rapidly
const recentToasts = new Map<string, number>();
const DEDUPE_INTERVAL_MS = 1200;

function shouldThrottle(message: string, id?: string | number): boolean {
  const key = id ? `id:${id}` : `msg:${message}`;
  const now = Date.now();
  const lastTime = recentToasts.get(key);

  if (lastTime && (now - lastTime) < DEDUPE_INTERVAL_MS) {
    return true;
  }

  recentToasts.set(key, now);

  // Clean old keys
  if (recentToasts.size > 50) {
    for (const [k, time] of recentToasts.entries()) {
      if (now - time > 5000) {
        recentToasts.delete(k);
      }
    }
  }

  return false;
}

export interface CustomToastOptions {
  id?: string | number;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  } | React.ReactNode;
  cancel?: {
    label: string;
    onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  } | React.ReactNode;
  onDismiss?: (toast: any) => void;
  onAutoClose?: (toast: any) => void;
  dismissPrevious?: boolean;
}

/**
 * Intelligent toast wrapper on top of Sonner with automatic deduplication,
 * rate limiting, and single-source feedback handling.
 */
export const toast = {
  success: (message: string, options?: CustomToastOptions) => {
    if (shouldThrottle(message, options?.id)) return options?.id || '';
    if (options?.dismissPrevious) {
      sonnerToast.dismiss();
    }
    return sonnerToast.success(message, {
      id: options?.id,
      description: options?.description,
      duration: options?.duration || 2600,
      action: options?.action as any,
      cancel: options?.cancel as any,
      onDismiss: options?.onDismiss,
      onAutoClose: options?.onAutoClose,
    });
  },

  error: (message: string, options?: CustomToastOptions) => {
    if (shouldThrottle(message, options?.id)) return options?.id || '';
    if (options?.dismissPrevious) {
      sonnerToast.dismiss();
    }
    return sonnerToast.error(message, {
      id: options?.id,
      description: options?.description,
      duration: options?.duration || 3500,
      action: options?.action as any,
      cancel: options?.cancel as any,
      onDismiss: options?.onDismiss,
      onAutoClose: options?.onAutoClose,
    });
  },

  info: (message: string, options?: CustomToastOptions) => {
    if (shouldThrottle(message, options?.id)) return options?.id || '';
    if (options?.dismissPrevious) {
      sonnerToast.dismiss();
    }
    return sonnerToast.info(message, {
      id: options?.id,
      description: options?.description,
      duration: options?.duration || 2800,
      action: options?.action as any,
      cancel: options?.cancel as any,
      onDismiss: options?.onDismiss,
      onAutoClose: options?.onAutoClose,
    });
  },

  warning: (message: string, options?: CustomToastOptions) => {
    if (shouldThrottle(message, options?.id)) return options?.id || '';
    if (options?.dismissPrevious) {
      sonnerToast.dismiss();
    }
    return sonnerToast.warning(message, {
      id: options?.id,
      description: options?.description,
      duration: options?.duration || 3200,
      action: options?.action as any,
      cancel: options?.cancel as any,
      onDismiss: options?.onDismiss,
      onAutoClose: options?.onAutoClose,
    });
  },

  loading: (message: string, options?: { id?: string | number; description?: string }) => {
    return sonnerToast.loading(message, {
      id: options?.id,
      description: options?.description,
    });
  },

  dismiss: (id?: string | number) => {
    return sonnerToast.dismiss(id);
  },

  promise: sonnerToast.promise,
  custom: sonnerToast.custom,
  message: sonnerToast.message,
};
