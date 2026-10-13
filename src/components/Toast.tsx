import { createContext, useCallback, useContext, useRef, useState } from 'react';
type T = { id: number; msg: string; action?: { label: string; run: () => void } };
const Ctx = createContext<(msg: string, action?: T['action']) => void>(() => {});
export const useToast = () => useContext(Ctx);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, set] = useState<T[]>([]); const n = useRef(0);
  const push = useCallback((msg: string, action?: T['action']) => {
    const id = ++n.current; set((x) => [...x.slice(-2), { id, msg, action }]);
    setTimeout(() => set((x) => x.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-6 left-1/2 z-[70] w-[calc(100vw-2rem)] max-w-md flex -translate-x-1/2 flex-col items-center gap-2">
        {items.map((t) => (
          <div key={t.id} className="toast pointer-events-auto flex max-w-full items-center gap-4 border border-brass-soft bg-footer px-5 py-2.5 text-footer-ink shadow-[0_6px_18px_rgba(0,0,0,.4)]">
            <span>{t.msg}</span>
            {t.action && <button className="font-display underline hover:text-white" onClick={() => { t.action!.run(); set((x) => x.filter((y) => y.id !== t.id)); }}>{t.action.label}</button>}
          </div>))}
      </div>
    </Ctx.Provider>
  );
}
