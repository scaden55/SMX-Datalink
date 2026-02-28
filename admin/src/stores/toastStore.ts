import { create } from 'zustand';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (t) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.duration);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = {
  success: (message: string) => useToastStore.getState().addToast({ type: 'success', message, duration: 5000 }),
  error: (message: string) => useToastStore.getState().addToast({ type: 'error', message, duration: 7000 }),
  warning: (message: string) => useToastStore.getState().addToast({ type: 'warning', message, duration: 6000 }),
  info: (message: string) => useToastStore.getState().addToast({ type: 'info', message, duration: 5000 }),
};
