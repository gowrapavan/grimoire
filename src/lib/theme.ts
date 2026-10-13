import { useCallback, useEffect, useState } from 'react';
const KEY = 'grimoire.theme';
export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);
  const toggle = useCallback(() => setDark((d) => { const n = !d; try { localStorage.setItem(KEY, n ? 'dark' : 'light'); } catch { /* ignore */ } return n; }), []);
  return { dark, toggle };
}
