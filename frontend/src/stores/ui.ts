// UI-Zustand ohne Fachlogik: Toasts und Bestätigungsdialog.
import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToastTone = 'info' | 'success' | 'error' | 'gold';
export interface ToastAction { label: string; run: () => void }
export interface Toast { id: number; message: string; tone: ToastTone; action?: ToastAction }

export interface ConfirmOptions { title: string; message: string; confirmText?: string; danger?: boolean }
interface DialogState extends Required<ConfirmOptions> { open: boolean; resolve: ((ok: boolean) => void) | null }

const closedDialog = (): DialogState => ({ open: false, title: '', message: '', confirmText: 'Confirm', danger: false, resolve: null });

export const useUiStore = defineStore('ui', () => {
  const toasts = ref<Toast[]>([]);
  const dialog = ref<DialogState>(closedDialog());

  function dismiss(id: number) { toasts.value = toasts.value.filter((t) => t.id !== id); }

  /** Kurze Meldung; mit `action` (z. B. Rückgängig) bleibt sie länger stehen. */
  function toast(message: string, tone: ToastTone = 'info', action?: ToastAction) {
    const id = Date.now() + Math.random();
    toasts.value = [...toasts.value.slice(-2), { id, message, tone, action }];
    setTimeout(() => dismiss(id), action ? 6000 : tone === 'error' ? 5000 : 3000);
  }

  function runAction(id: number) {
    const entry = toasts.value.find((t) => t.id === id);
    dismiss(id);
    entry?.action?.run();
  }

  /** Promise-basierter Bestätigungsdialog: `if (!(await confirm({...}))) return;` */
  function confirm({ title, message, confirmText = 'Confirm', danger = false }: ConfirmOptions): Promise<boolean> {
    dialog.value.resolve?.(false); // ein offener Dialog wird abgebrochen
    return new Promise((resolve) => {
      dialog.value = { open: true, title, message, confirmText, danger, resolve };
    });
  }

  function resolveDialog(result: boolean) {
    const { resolve } = dialog.value;
    dialog.value = { ...dialog.value, open: false, resolve: null };
    resolve?.(result);
  }

  return { toasts, dialog, toast, dismiss, runAction, confirm, resolveDialog };
});
