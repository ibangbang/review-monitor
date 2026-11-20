import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastTone = 'success' | 'error' | 'info';
type ToastItem = { id: number; tone: ToastTone; message: string };

const ToastContext = createContext<{ push: (tone: ToastTone, message: string) => void } | null>(null);

const icons = { success: CheckCircle2, error: AlertTriangle, info: Info };
const tones: Record<ToastTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-slate-200 bg-white text-slate-800',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, tone, message }]);
    window.setTimeout(() => setItems((prev) => prev.filter((item) => item.id !== id)), 4000);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-80 flex-col gap-2">
        {items.map((item) => {
          const Icon = icons[item.tone];
          return (
            <div
              key={item.id}
              className={cn(
                'pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-xs shadow-card',
                tones[item.tone],
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="flex-1 leading-relaxed">{item.message}</p>
              <button
                onClick={() => setItems((prev) => prev.filter((entry) => entry.id !== item.id))}
                className="mt-0.5 opacity-60 hover:opacity-100"
                aria-label="关闭提示"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast 必须在 ToastProvider 内使用');
  return context;
}
