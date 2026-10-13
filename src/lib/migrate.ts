// The site used to be called Marginalia and saved things under "marginalia.*" in the browser. Copy them to "grimoire.*" once, so
// nobody loses their saved shelf, reading place or theme. The old keys are left alone (harmless). Imported first in main.tsx.
export function migrateStorage(store: Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem'> | undefined = typeof localStorage === 'undefined' ? undefined : localStorage) {
  if (!store) return;
  try {
    const old: string[] = []; for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k && k.startsWith('marginalia.')) old.push(k); }
    for (const k of old) { const n = 'grimoire.' + k.slice('marginalia.'.length); const v = store.getItem(k); if (v !== null && store.getItem(n) === null) store.setItem(n, v); }
  } catch { /* storage blocked: nothing to migrate */ }
}
migrateStorage();
