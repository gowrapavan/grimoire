import { CatalogError } from './catalog';
import { useEffect, useState } from 'react';
export type AsyncState<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): [AsyncState<T>, () => void] {
  const [s, set] = useState<AsyncState<T>>({ status: 'loading' });
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true; set({ status: 'loading' });
    fn().then((data) => live && set({ status: 'ready', data }), (e) => live && set({ status: 'error', message: e instanceof CatalogError ? e.message : 'Something went wrong while loading. Try again.' }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return [s, () => setN((x) => x + 1)];
}
