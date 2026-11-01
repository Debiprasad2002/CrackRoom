import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md';
}

/** Built on the native <dialog>: focus trapping, Escape and top-layer stacking come for free. */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        // Phones: a bottom sheet within thumb reach. Larger screens: a centred card.
        'overflow-y-auto border border-line-strong bg-ink-800 p-0 text-fg shadow-pop',
        // Margins are !important: a parent's space-y-* rule would otherwise pull the dialog to the top.
        '!mb-0 !mt-auto max-h-[90dvh] w-full max-w-none rounded-t-3xl border-b-0 pb-[env(safe-area-inset-bottom)]',
        'sm:!my-auto sm:max-h-[min(44rem,calc(100dvh-2rem))] sm:w-[calc(100vw-2rem)] sm:rounded-2xl sm:border-b sm:pb-0',
        size === 'sm' ? 'sm:max-w-sm' : 'sm:max-w-lg',
      )}
    >
      {open && (
        <div className="p-5 sm:p-6">
          <div className="mx-auto -mt-2 mb-4 h-1 w-10 rounded-full bg-ink-500 sm:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-1 text-sm text-fg-muted">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="-mr-1.5 -mt-1 rounded-lg p-1.5 text-fg-subtle hover:bg-ink-700 hover:text-fg"
            >
              <X className="size-[18px]" aria-hidden />
            </button>
          </div>
          {children && <div className="mt-5">{children}</div>}
          {footer && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&>*]:h-11 sm:[&>*]:h-10">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
