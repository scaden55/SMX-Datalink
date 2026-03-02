import { toast as sonnerToast } from 'sonner';

// Thin wrapper preserving the existing toast.success/error/warning/info API.
// All pages import { toast } from '@/stores/toastStore' — no changes needed.
export const toast = {
  success: (message: string) => sonnerToast.success(message),
  error: (message: string) => sonnerToast.error(message),
  warning: (message: string) => sonnerToast.warning(message),
  info: (message: string) => sonnerToast.info(message),
};
