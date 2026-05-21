/**
 * Global toast notification system.
 * Usage:
 *   import { toast } from '@/lib/toast'
 *   toast.success('Saved!')
 *   toast.error('Something went wrong')
 */

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  message: string
  type: ToastType
  duration: number
}

type Listener = (toasts: Toast[]) => void

let toasts: Toast[] = []
const listeners: Set<Listener> = new Set()

function notify() {
  listeners.forEach(l => l([...toasts]))
}

function add(message: string, type: ToastType, duration = 3800) {
  const id = Math.random().toString(36).slice(2)
  const t: Toast = { id, message, type, duration }
  toasts = [...toasts, t]
  notify()
  setTimeout(() => remove(id), duration)
}

function remove(id: string) {
  toasts = toasts.filter(t => t.id !== id)
  notify()
}

export const toast = {
  success: (msg: string, duration?: number) => add(msg, 'success', duration),
  error:   (msg: string, duration?: number) => add(msg, 'error', duration),
  info:    (msg: string, duration?: number) => add(msg, 'info', duration),
  warning: (msg: string, duration?: number) => add(msg, 'warning', duration),
  dismiss: (id: string) => remove(id),
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
