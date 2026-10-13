import { useSyncExternalStore } from 'react';
// "My shelf": book ids saved in this browser only (localStorage). Nothing is sent anywhere.
const KEY = 'grimoire.shelf.v1';
const read = (): string[] => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && /^\d{1,9}$/.test(x)).slice(0, 500) : []; } catch { return []; } };
let ids = read();
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === KEY) { ids = read(); emit(); } });
export function setShelf(next: string[]) { ids = next.slice(0, 500); try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* storage blocked: shelf lasts for this visit only */ } emit(); }
export function useShelf() {
  const list = useSyncExternalStore(subscribe, () => ids, () => ids);
  return {
    ids: list,
    has: (id: string) => list.includes(id),
    /** Returns true if the book is now on the shelf. */
    toggle(id: string) { const on = !list.includes(id); setShelf(on ? [id, ...list] : list.filter((x) => x !== id)); return on; },
  };
}
