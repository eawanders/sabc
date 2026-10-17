'use client';
// Bottom-right toasts: dark for your own changes (with Undo ⌘Z), light with a red dot for conflicts.
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type Toast = { id: number; text: string; warn: boolean; onUndo?: () => void };
type ShowToast = (text: string, opts?: { warn?: boolean; onUndo?: () => void }) => void;

const ToastContext = createContext<ShowToast>(() => {});

export function useToast(): ShowToast {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback<ShowToast>(
    (text, opts = {}) => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-3), { id, text, warn: Boolean(opts.warn), onUndo: opts.onUndo }]);
      setTimeout(() => dismiss(id), opts.warn ? 6000 : 3500);
    },
    [dismiss],
  );

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="b-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`b-toast${t.warn ? ' warn' : ''}`}>
            <span className="t">{t.text}</span>
            {t.onUndo && (
              <button
                type="button"
                onClick={() => {
                  dismiss(t.id);
                  t.onUndo?.();
                }}
              >
                Undo<kbd>⌘Z</kbd>
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
