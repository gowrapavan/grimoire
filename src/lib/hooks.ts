import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { catalog } from './catalog';
import { parseParams } from './params';
import type { Book } from './types';
export function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
/** Live title/author suggestions while typing. Ignores out-of-date answers. */
export function useSuggest(q: string, limit = 6) {
  const dq = useDebounced(q.trim(), 150);
  const [state, set] = useState<{ q: string; items: Book[]; total: number }>({ q: '', items: [], total: 0 });
  const seq = useRef(0);
  useEffect(() => {
    if (dq.length < 2) { set({ q: dq, items: [], total: 0 }); return; }
    const mine = ++seq.current;
    catalog.search({ ...parseParams(new URLSearchParams({ q: dq })), sort: 'relevance' })
      .then((r) => { if (mine === seq.current) set({ q: dq, items: r.items.slice(0, limit), total: r.total }); })
      .catch(() => { if (mine === seq.current) set({ q: dq, items: [], total: 0 }); });
  }, [dq, limit]);
  return state;
}
export function useScrolled(px = 600) {
  const [s, set] = useState(false);
  useEffect(() => { const f = () => set(window.scrollY > px); f(); window.addEventListener('scroll', f, { passive: true }); return () => window.removeEventListener('scroll', f); }, [px]);
  return s;
}
export function usePersisted<T extends string>(key: string, initial: T, allowed: readonly T[]): [T, (v: T) => void] {
  const [v, set] = useState<T>(() => { try { const x = localStorage.getItem(key) as T | null; return x && allowed.includes(x) ? x : initial; } catch { return initial; } });
  return [v, (n) => { set(n); try { localStorage.setItem(key, n); } catch { /* ignore */ } }];
}
/** Jumps to a random book in the catalogue. */
export function useSurprise() {
  const nav = useNavigate();
  return async () => { try { const [b] = await catalog.random(1); if (b) nav(`/book/${encodeURIComponent(b.id)}`); } catch { /* catalog error is shown on the page itself */ } };
}

/** True on phone-sized screens (under 640px). */
export function useIsPhone() {
  const Q = '(max-width: 639px)';
  const [m, set] = useState(() => typeof window !== 'undefined' && window.matchMedia(Q).matches);
  useEffect(() => { const q = window.matchMedia(Q); const f = () => set(q.matches); f(); q.addEventListener('change', f); return () => q.removeEventListener('change', f); }, []);
  return m;
}
