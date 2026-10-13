import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Book } from '../lib/types';
import { SOURCES, ACCESS } from '../lib/access';
import { LANGUAGES } from '../lib/catalog';
import { Cover, SaveButton, StatusBadge } from './ui';
const Ctx = createContext<{ open: (b: Book) => void }>({ open: () => {} });
export const useQuickView = () => useContext(Ctx);
export function QuickViewProvider({ children }: { children: React.ReactNode }) {
  const [book, setBook] = useState<Book | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => { const d = ref.current; if (book && d && !d.open) d.showModal(); }, [book]);
  const close = () => { ref.current?.close(); };
  const open = (b: Book) => { opener.current = document.activeElement; setBook(b); };
  return (
    <Ctx.Provider value={{ open }}>
      {children}
      <dialog ref={ref} className="qv" aria-labelledby="qv-title" onClose={() => { setBook(null); (opener.current as HTMLElement | null)?.focus?.(); }}
        onClick={(e) => { if (e.target === ref.current) close(); }}>
        {book && (
          <div className="relative grid gap-4 p-4 sm:grid-cols-[11rem_1fr] sm:gap-6 sm:p-8">
            <button type="button" onClick={close} aria-label="Close quick look" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-line text-xl leading-none hover:border-oxblood hover:text-oxblood">×</button>
            <div className="mx-auto w-28 sm:w-full"><Cover book={book} priority /></div>
            <div>
              <h2 id="qv-title" className="pr-8 text-2xl leading-tight sm:text-3xl text-oxblood">{book.title}</h2>
              <p className="mt-1 text-lg italic text-ink-2">{book.authors.join('; ') || 'Unknown author'}</p>
              <div className="mt-3 flex items-center gap-3"><StatusBadge status={book.accessStatus} /><span className="italic text-muted">per {SOURCES[book.source].name}</span></div>
              <p className="mt-3 text-[0.95rem]">{ACCESS[book.accessStatus].explain}</p>
              <p className="mt-3 text-muted">{LANGUAGES[book.language] ?? (book.language || 'Language not known')}{book.subjects.length > 0 && <> · {book.subjects.slice(0, 3).join(' · ')}</>}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link onClick={close} to={`/book/${encodeURIComponent(book.id)}`} className="inline-block bg-oxblood px-4 py-2 font-display text-base sm:px-5 sm:py-2.5 sm:text-lg text-on no-underline hover:bg-oxblood-dark">Open details</Link>
                {book.accessStatus === 'open_access' && <Link onClick={close} to={`/read/${encodeURIComponent(book.id)}`} className="inline-block border border-ink-2 px-4 py-2 font-display text-base sm:px-5 sm:py-2.5 sm:text-lg no-underline hover:bg-paper-2">Read now</Link>}
                <SaveButton book={book} full />
              </div>
            </div>
          </div>)}
      </dialog>
    </Ctx.Provider>
  );
}
