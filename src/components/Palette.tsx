import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSuggest, useSurprise } from '../lib/hooks';
import { Cover, Highlight } from './ui';
const Ctx = createContext<{ open: () => void }>({ open: () => {} });
export const usePalette = () => useContext(Ctx);
type Item = { key: string; label: string; sub?: string; node?: React.ReactNode; run: () => void };
/** Ctrl+K (or "/") opens a jump-anywhere box: find a book, or run a quick action. */
export function PaletteProvider({ children, toggleTheme, dark }: { children: React.ReactNode; toggleTheme: () => void; dark: boolean }) {
  const ref = useRef<HTMLDialogElement>(null); const nav = useNavigate(); const surprise = useSurprise();
  const [isOpen, setOpen] = useState(false); const [q, setQ] = useState(''); const [active, setActive] = useState(0);
  const sug = useSuggest(q, 7);
  const open = () => { setQ(''); setActive(0); setOpen(true); };
  const close = () => ref.current?.close();
  useEffect(() => { if (isOpen && ref.current && !ref.current.open) ref.current.showModal(); }, [isOpen]);
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable;
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey)) { e.preventDefault(); open(); }
    };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, []);
  const go = (to: string) => () => { close(); nav(to); };
  const actions: Item[] = [
    { key: 'browse', label: 'Browse the catalogue', sub: 'All books, with filters', run: go('/search?sort=title') },
    { key: 'shelf', label: 'My shelf', sub: 'Books you saved on this device', run: go('/shelf') },
    { key: 'surprise', label: 'Surprise me', sub: 'Open a random book', run: () => { close(); surprise(); } },
    { key: 'theme', label: dark ? 'Switch to daylight' : 'Switch to lamplight', sub: 'Change the colours', run: () => { toggleTheme(); close(); } },
  ];
  const typed = q.trim().length >= 2;
  const items: Item[] = typed && sug.q === q.trim()
    ? [...sug.items.map((b) => ({ key: b.id, label: b.title, sub: b.authors.join('; ') || 'Unknown author', node: <div className="w-7 flex-none"><Cover book={b} mini /></div>, run: go(`/book/${encodeURIComponent(b.id)}`) })),
       { key: 'all', label: `See all ${sug.total} results for “${q.trim()}”`, run: go(`/search?q=${encodeURIComponent(q.trim())}`) }]
    : typed ? [] : actions;
  const a = Math.min(active, Math.max(items.length - 1, 0));
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((x) => (items.length ? (x + 1) % items.length : 0)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((x) => (items.length ? (x - 1 + items.length) % items.length : 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); items[a]?.run(); }
  };
  return (
    <Ctx.Provider value={{ open }}>
      {children}
      <dialog ref={ref} className="qv !mt-[12vh] !mb-auto" aria-label="Search and quick actions" onClose={() => setOpen(false)} onClick={(e) => { if (e.target === ref.current) close(); }}>
        {isOpen && (
          <div>
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={key} placeholder="Find a book, or choose an action" aria-label="Find a book or choose an action"
              role="combobox" aria-expanded="true" aria-controls="pal-list" aria-activedescendant={items[a] ? `pal-${items[a].key}` : undefined}
              className="w-full border-b border-line bg-transparent px-5 py-4 text-xl italic placeholder:text-muted focus:outline-none" />
            <ul id="pal-list" role="listbox" className="max-h-[22rem] overflow-auto py-2">
              {items.map((it, i) => (
                <li key={it.key} id={`pal-${it.key}`} role="option" aria-selected={i === a} onMouseEnter={() => setActive(i)} onClick={it.run}
                  className={`flex cursor-pointer items-center gap-3 px-5 py-2 ${i === a ? 'bg-paper-2' : ''}`}>
                  {it.node}
                  <div className="min-w-0"><p className="line-clamp-1 text-lg leading-tight"><Highlight text={it.label} q={typed ? q : ''} /></p>{it.sub && <p className="line-clamp-1 text-sm italic text-muted">{it.sub}</p>}</div>
                </li>))}
              {typed && !items.length && <li className="px-5 py-3 italic text-muted" role="presentation">Looking…</li>}
            </ul>
            <p className="border-t border-line px-5 py-2 text-sm italic text-muted">Up and down to choose, Enter to open, Esc to close.</p>
          </div>)}
      </dialog>
    </Ctx.Provider>
  );
}
