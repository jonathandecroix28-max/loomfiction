import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé dans <FeedbackProvider>');
  return ctx;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm doit être utilisé dans <FeedbackProvider>');
  return ctx;
}

const MAX_TOASTS = 4;
const DURATION: Record<ToastTone, number> = { success: 3500, info: 4000, error: 6000 };

const TONE_STYLES: Record<ToastTone, { border: string; dot: string }> = {
  success: { border: 'border-emerald-700/40', dot: 'bg-emerald-500' },
  error: { border: 'border-red-700/50', dot: 'bg-red-500' },
  info: { border: 'border-amber-700/40', dot: 'bg-amber-500' },
};

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const styles = TONE_STYLES[toast.tone];

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => onClose(toast.id), DURATION[toast.tone]);
    return () => window.clearTimeout(timer);
  }, [paused, toast.id, toast.tone, onClose]);

  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border bg-neutral-950/95 px-4 py-3 shadow-xl backdrop-blur animate-[toast-in_180ms_ease-out] ${styles.border}`}
    >
      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${styles.dot}`} aria-hidden="true" />
      <p className="min-w-0 flex-1 break-words font-sans text-sm text-amber-100">{toast.message}</p>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        className="-mr-1 shrink-0 cursor-pointer rounded-md px-1.5 text-lg leading-none text-amber-200/50 transition-colors hover:text-amber-100"
        aria-label="Fermer la notification"
      >
        ×
      </button>
    </div>
  );
}

function ConfirmDialog({
  pending,
  onAnswer,
}: {
  pending: PendingConfirm;
  onAnswer: (value: boolean) => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const danger = pending.tone === 'danger';

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onAnswer(false);
      } else if (e.key === 'Tab') {
        const first = cancelRef.current;
        const last = confirmRef.current;
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onAnswer]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onAnswer(false);
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={pending.message ? 'confirm-message' : undefined}
        className="w-full max-w-sm rounded-2xl border border-amber-900/30 bg-neutral-950 p-5 shadow-2xl animate-[toast-in_180ms_ease-out]"
      >
        <h2 id="confirm-title" className="font-serif text-lg font-bold text-amber-100">
          {pending.title}
        </h2>
        {pending.message && (
          <div id="confirm-message" className="mt-2 font-sans text-sm text-amber-200/70">
            {pending.message}
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onAnswer(false)}
            className="cursor-pointer rounded-lg border border-amber-900/30 bg-amber-950/60 px-4 py-2 font-sans text-sm font-medium text-amber-200 transition-colors hover:bg-amber-900/70"
          >
            {pending.cancelLabel ?? 'Annuler'}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onAnswer(true)}
            className={`cursor-pointer rounded-lg px-4 py-2 font-sans text-sm font-semibold text-white transition-colors ${
              danger ? 'bg-red-700 hover:bg-red-600' : 'bg-amber-700 hover:bg-amber-600'
            }`}
          >
            {pending.confirmLabel ?? (danger ? 'Supprimer' : 'Confirmer')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const nextId = useRef(1);
  const pendingRef = useRef<PendingConfirm | null>(null);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const closeToast = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = nextId.current++;
    setToasts((list) => [...list, { id, tone, message }].slice(-MAX_TOASTS));
  }, []);

  const toastApi = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      pendingRef.current?.resolve(false);
      setPending({ ...options, resolve });
    });
  }, []);

  const answer = useCallback((value: boolean) => {
    pendingRef.current?.resolve(value);
    setPending(null);
  }, []);

  return (
    <ToastContext.Provider value={toastApi}>
      <ConfirmContext.Provider value={confirm}>
        {children}

        {pending && <ConfirmDialog pending={pending} onAnswer={answer} />}

        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[110] flex flex-col items-center gap-2 p-4 sm:items-end"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <div className="flex w-full max-w-sm flex-col gap-2">
            {toasts.map((t) => (
              <ToastCard key={t.id} toast={t} onClose={closeToast} />
            ))}
          </div>
        </div>
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}