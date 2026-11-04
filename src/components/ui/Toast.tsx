import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { uid } from '@/lib/storage';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone: 'info' | 'success' | 'error';
}

type Notify = (toast: { title: string; description?: string; tone?: ToastItem['tone'] }) => void;

const ToastContext = createContext<Notify | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const notify = useCallback<Notify>(
    ({ title, description, tone = 'info' }) => {
      const id = uid();
      setToasts((list) => [...list.slice(-2), { id, title, description, tone }]);
      timers.current.set(id, window.setTimeout(() => dismiss(id), 4500));
    },
    [dismiss],
  );

  const value = useMemo(() => notify, [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[calc(4.25rem+env(safe-area-inset-top))] z-50 flex flex-col items-center gap-2 px-4 md:top-6 md:items-end md:px-6"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line-strong bg-ink-700 p-3.5 shadow-pop"
              role="status"
            >
              {t.tone === 'success' ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mint-400" aria-hidden />
              ) : t.tone === 'error' ? (
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-400" aria-hidden />
              ) : (
                <Info className="mt-0.5 size-4 shrink-0 text-cyan-300" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">{t.title}</p>
                {t.description && <p className="mt-0.5 text-[13px] leading-snug text-fg-muted">{t.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="-m-1 rounded-md p-1 text-fg-subtle hover:bg-ink-600 hover:text-fg"
                aria-label="Dismiss notification"
              >
                <X className="size-4" aria-hidden />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
