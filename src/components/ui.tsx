import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Book } from '../lib/types';
import { ACCESS } from '../lib/access';
import { useShelf } from '../lib/shelf';
import { useSuggest } from '../lib/hooks';
import { useToast } from './Toast';
import { useQuickView } from './QuickView';
import { covers } from '../lib/coverLoader';

const CLOTH = ['#5b1a20', '#1f3a2e', '#2b2f4a', '#4a3220', '#3d2a45', '#243b4a'];
export const clothFor = (title: string) => CLOTH[[...title].reduce((a, c) => a + c.charCodeAt(0), 0) % CLOTH.length];

/** Shows the cover. The picture itself comes from the shared loader (src/lib/coverLoader.ts): the same image is fetched once,
 *  every place that shows it updates together, and a cover that gave up is tried again when it scrolls back into view.
 *  Until the image is ready a cloth placeholder with the title is shown. */
export function Cover({ book, className = '', mini = false, priority = false }: { book: Book; className?: string; mini?: boolean; priority?: boolean }) {
  const url = book.coverUrl; const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(priority || typeof IntersectionObserver === 'undefined'); const [seen, setSeen] = useState(0); const [shown, setShown] = useState('');
  useSyncExternalStore(covers.subscribe, () => covers.version(url, mini), () => '');
  // Start loading when the cover is close to the screen (a bit early, so it is ready when you get there).
  // Every time it comes into view again, a cover that had given up gets another chance.
  useEffect(() => {
    const el = box.current; if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setNear(true); setSeen((n) => n + 1); } }, { rootMargin: '300px' });
    io.observe(el); return () => io.disconnect();
  }, []);
  useEffect(() => { if (near) covers.ensure(url, { mini, priority }); }, [url, mini, priority, near, seen]);
  const c = covers.derive(url, mini); const src = c.status === 'ok' ? c.src : undefined; const failed = !url || c.status === 'fail';
  const shadow = mini ? '' : 'shadow-[3px_4px_0_rgba(60,40,20,.28)]';
  return (
    <div ref={box} className={`relative aspect-[2/3] w-full overflow-hidden border border-line bg-paper-2 ${shadow} ${className}`}>
      <div role={src ? undefined : 'img'} aria-hidden={src ? true : undefined} aria-label={src ? undefined : `No cover available for ${book.title}`}
        style={{ background: clothFor(book.title) }} className={`absolute inset-0 border-l-[7px] border-black/30 ${mini ? 'p-0.5' : 'p-2'}`}>
        <div className="flex h-full flex-col justify-between border border-brass-soft/80 p-1 text-center text-[#ead9a6] sm:p-2">
          <span className={`font-display leading-tight line-clamp-5 ${mini ? 'text-[0.45rem]' : 'text-[0.95rem]'}`}>{book.title}</span>
          {!mini && <span className="text-xs italic line-clamp-2">{book.authors[0] ?? 'Unknown author'}<br />{failed ? '(no cover available)' : ''}</span>}
        </div>
      </div>
      {src && <img key={src} src={src} alt={mini ? '' : `Cover of ${book.title}`} decoding="async" fetchPriority={priority ? 'high' : undefined}
        onLoad={() => setShown(src)} onError={() => url && covers.markBroken(url, src)} className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${shown === src ? 'opacity-100' : 'opacity-0'}`} />}
    </div>
  );
}

/** Cover that leans toward the pointer, with a soft glare. Decorative only. */
export function TiltCover({ book, fill = false }: { book: Book; fill?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const el = ref.current; if (!el || e.pointerType === 'touch') return;
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.classList.remove('idle');
    el.style.setProperty('--ry', `${(x - 0.5) * 22}deg`); el.style.setProperty('--rx', `${(0.5 - y) * 18}deg`);
    el.style.setProperty('--gx', `${x * 100}%`); el.style.setProperty('--gy', `${y * 100}%`); el.style.setProperty('--glare', '.55');
  };
  const leave = () => { const el = ref.current; if (!el) return; el.classList.add('idle'); ['--rx', '--ry', '--glare'].forEach((k) => el.style.removeProperty(k)); };
  return (
    <div className={`tilt-wrap ${fill ? 'h-full' : ''}`} onPointerMove={move} onPointerLeave={leave}>
      <div ref={ref} className={`tilt idle ${fill ? 'h-full' : ''}`}><Cover book={book} priority className={`!shadow-[10px_14px_22px_rgba(40,25,10,.45)] ${fill ? 'lg:!aspect-auto lg:!h-full' : ''}`} /><div className="tilt-glare" aria-hidden="true" /></div>
    </div>
  );
}

export const StatusBadge = ({ status }: { status: Book['accessStatus'] }) => (
  <span className={`inline-block rounded-sm px-2 py-0.5 text-sm italic ring-1 ${ACCESS[status].cls}`}>{ACCESS[status].short}</span>
);

const iconBtn = 'grid h-9 w-9 place-items-center rounded-full border border-line bg-card/95 text-ink shadow-[0_2px_6px_rgba(0,0,0,.25)] backdrop-blur hover:border-oxblood hover:text-oxblood';
export function useToggleSave() {
  const shelf = useShelf(); const toast = useToast();
  return { shelf, toggle(b: Book) {
    const on = shelf.toggle(b.id);
    toast(on ? `Saved “${b.title.slice(0, 40)}” to your shelf` : 'Removed from your shelf', { label: 'Undo', run: () => shelf.toggle(b.id) });
  } };
}
export function SaveButton({ book, full = false, small = false }: { book: Book; full?: boolean; small?: boolean }) {
  const { shelf, toggle } = useToggleSave(); const on = shelf.has(book.id);
  const [pop, setPop] = useState(false);
  const heart = <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className={pop ? 'heart-pop' : ''} fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8"><path d="M12 20.5s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.7a4.4 4.4 0 0 1 7.5 2.7c0 5.5-7.5 10.1-7.5 10.1z" /></svg>;
  const click = () => { setPop(true); toggle(book); setTimeout(() => setPop(false), 350); };
  if (full) return <button type="button" aria-pressed={on} onClick={click} className={`inline-flex items-center gap-2 border font-display ${small ? 'px-3.5 py-1.5 text-[0.95rem] sm:px-4 sm:py-2 sm:text-base' : 'px-4 py-2 text-base sm:px-5 sm:py-2.5 sm:text-lg'} ${on ? 'border-oxblood bg-oxblood/10 text-oxblood' : 'border-ink-2 hover:bg-paper-2'}`}>{heart}{on ? 'On your shelf' : 'Save to my shelf'}</button>;
  return <button type="button" aria-pressed={on} aria-label={`${on ? 'Remove' : 'Save'} ${book.title} ${on ? 'from' : 'to'} my shelf`} title={on ? 'On your shelf' : 'Save to my shelf'} onClick={click} className={`${iconBtn} ${on ? '!text-oxblood' : ''}`}>{heart}</button>;
}
export function QuickLookButton({ book }: { book: Book }) {
  const { open } = useQuickView();
  return <button type="button" aria-label={`Quick look at ${book.title}`} title="Quick look" onClick={() => open(book)} className={iconBtn}>
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
  </button>;
}

export function BookCard({ book }: { book: Book }) {
  return (
    <div className="book-tile relative">
      <Link to={`/book/${encodeURIComponent(book.id)}`} className="group block no-underline">
        <Cover book={book} className="card-cover" />
        <h3 className="mt-2 text-base leading-snug underline-offset-4 sm:mt-3 sm:text-lg group-hover:underline line-clamp-2">{book.title}</h3>
        <p className="text-[0.95rem] italic text-muted line-clamp-1">{book.authors.join('; ') || 'Unknown author'}</p>
      </Link>
      <div className="mt-1"><StatusBadge status={book.accessStatus} /></div>
      <div className="tile-actions absolute right-2 top-2 flex flex-col gap-1.5"><SaveButton book={book} /><QuickLookButton book={book} /></div>
    </div>
  );
}
export function BookRow({ book }: { book: Book }) {
  return (
    <li className="book-tile flex gap-4 border-b border-line/70 py-4">
      <Link to={`/book/${encodeURIComponent(book.id)}`} className="block w-16 flex-none sm:w-20" aria-hidden="true" tabIndex={-1}><Cover book={book} mini /></Link>
      <div className="min-w-0 flex-1">
        <h3 className="text-xl leading-snug"><Link to={`/book/${encodeURIComponent(book.id)}`} className="no-underline hover:text-oxblood hover:underline">{book.title}</Link></h3>
        <p className="italic text-muted">{book.authors.join('; ') || 'Unknown author'}</p>
        {book.subjects.length > 0 && <p className="mt-1 text-sm text-ink-2 line-clamp-1">{book.subjects.slice(0, 4).join(' · ')}</p>}
        <div className="mt-2"><StatusBadge status={book.accessStatus} /></div>
      </div>
      <div className="flex flex-none flex-col gap-1.5 sm:flex-row sm:items-start"><SaveButton book={book} /><QuickLookButton book={book} /></div>
    </li>
  );
}
export const BookGrid = ({ books, narrow = false }: { books: Book[]; narrow?: boolean }) => (
  <ul className={`grid grid-cols-2 gap-x-4 gap-y-7 sm:gap-x-6 sm:gap-y-10 sm:grid-cols-3 ${narrow ? 'xl:grid-cols-5' : 'md:grid-cols-4 lg:grid-cols-6'}`}>
    {books.map((b) => <li key={b.id}><BookCard book={b} /></li>)}
  </ul>
);
export const BookList = ({ books }: { books: Book[] }) => <ul className="border-t border-line/70">{books.map((b) => <BookRow key={b.id} book={b} />)}</ul>;

export function Rail({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const by = (d: number) => ref.current?.scrollBy({ left: d * Math.max(240, ref.current.clientWidth * 0.8), behavior: 'smooth' });
  const b = 'grid h-9 w-9 place-items-center rounded-full border border-line bg-card hover:border-oxblood hover:text-oxblood';
  return (
    <div>
      <div className="mb-2 hidden justify-end gap-2 sm:flex">
        <button type="button" aria-label={`Scroll ${label} left`} className={b} onClick={() => by(-1)}>‹</button>
        <button type="button" aria-label={`Scroll ${label} right`} className={b} onClick={() => by(1)}>›</button>
      </div>
      <div ref={ref} className="rail" role="list" aria-label={label} tabIndex={0}>{children}</div>
    </div>
  );
}

export const Loading = ({ label = 'Loading books' }: { label?: string }) => (
  <div role="status" aria-live="polite" className="grid grid-cols-2 gap-6 sm:grid-cols-4 lg:grid-cols-6">
    <span className="sr-only">{label}…</span>
    {Array.from({ length: 6 }).map((_, i) => <div key={i}><div className="skeleton aspect-[2/3] border border-line" /><div className="skeleton mt-3 h-4 w-4/5" /><div className="skeleton mt-2 h-3 w-1/2" /></div>)}
  </div>
);
export const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div role="alert" className="border-2 border-double border-oxblood/60 bg-card p-6">
    <p className="font-display text-xl text-oxblood">We could not load this page</p>
    <p className="mt-1 text-muted">{message}</p>
    <button onClick={onRetry} className="mt-4 bg-oxblood px-5 py-2 text-on hover:bg-oxblood-dark">Try again</button>
  </div>
);
export const EmptyState = ({ title, children }: { title: string; children?: React.ReactNode }) => (
  <div className="border border-dashed border-line bg-card/60 p-8 text-center">
    <p className="font-display text-xl">{title}</p><div className="mt-2 text-muted">{children}</div>
  </div>
);
export const Ornament = ({ className = '' }: { className?: string }) => (
  <svg aria-hidden="true" viewBox="0 0 240 14" className={`mx-auto h-3.5 w-60 text-brass-soft ${className}`}>
    <path d="M0 7h98M142 7h98" stroke="currentColor" strokeWidth="1" /><path d="M120 1l6 6-6 6-6-6z" fill="currentColor" /><circle cx="104" cy="7" r="2" fill="currentColor" /><circle cx="136" cy="7" r="2" fill="currentColor" />
  </svg>
);
export const Mark = () => (
  <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><rect x="1" y="1" width="32" height="32" fill="#6a1b22" stroke="#b8913a" strokeWidth="1.5" /><rect x="5" y="5" width="24" height="24" fill="none" stroke="#b8913a" strokeWidth=".8" />
    <rect x="9" y="8" width="16" height="18" fill="#e8d7a4"/><rect x="9" y="8" width="3" height="18" fill="#cdb97c"/><path d="M18.6 12.5l3.6 4.5-3.6 4.5-3.6-4.5z" fill="none" stroke="#6a1b22" strokeWidth="1.1"/><circle cx="18.6" cy="17" r="1" fill="#6a1b22"/><rect x="24" y="15" width="3.2" height="4" fill="#b8913a"/></svg>
);

export function Highlight({ text, q }: { text: string; q: string }) {
  const toks = q.toLowerCase().split(/\s+/).filter((t) => t.length > 1).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!toks.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${toks.join('|')})`, 'ig'));
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i} className="bg-brass-soft/35 text-inherit">{p}</mark> : p))}</>;
}

/** Search box that suggests books as you type. Arrow keys move, Enter opens, Escape closes. */
export function SearchBox({ initial = '', big = false }: { initial?: string; big?: boolean }) {
  const uid = useId(); const nav = useNavigate();
  const [q, setQ] = useState(initial); const [open, setOpen] = useState(false); const [active, setActive] = useState(-1);
  const sug = useSuggest(q); const wrap = useRef<HTMLFormElement>(null);
  useEffect(() => { setQ(initial); }, [initial]);
  const shown = open && q.trim().length >= 2 && sug.q === q.trim() && sug.items.length > 0;
  const total = sug.items.length + 1; // last option = "see all results"
  const all = () => { setOpen(false); nav(`/search?q=${encodeURIComponent(q.trim())}`); };
  const pick = (i: number) => { if (i < 0 || i === sug.items.length) return all(); setOpen(false); nav(`/book/${encodeURIComponent(sug.items[i].id)}`); };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && shown) { e.preventDefault(); setActive((a) => (a + 1) % total); }
    else if (e.key === 'ArrowUp' && shown) { e.preventDefault(); setActive((a) => (a <= 0 ? total - 1 : a - 1)); }
    else if (e.key === 'Escape') { if (open) { e.preventDefault(); setOpen(false); setActive(-1); } }
  };
  return (
    <form ref={wrap} role="search" className="relative flex w-full max-w-2xl" onSubmit={(e) => { e.preventDefault(); if (shown && active >= 0) pick(active); else if (q.trim()) all(); }}
      onBlur={(e) => { if (!wrap.current?.contains(e.relatedTarget as Node)) { setOpen(false); setActive(-1); } }}>
      <label htmlFor={`${uid}-q`} className="sr-only">Search by title or author</label>
      <input id={`${uid}-q`} name="q" type="search" value={q} maxLength={100} placeholder="Title or author" autoComplete="off"
        role="combobox" aria-expanded={shown} aria-controls={`${uid}-list`} aria-autocomplete="list" aria-activedescendant={shown && active >= 0 ? `${uid}-o${active}` : undefined}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }} onFocus={() => setOpen(true)} onKeyDown={key}
        className={`min-w-0 flex-1 border border-ink-2/60 bg-card px-3 sm:px-4 italic text-ink placeholder:text-muted ${big ? 'py-3 text-lg sm:py-3.5 sm:text-xl' : 'py-1.5'}`} />
      <button className={`border border-oxblood bg-oxblood px-4 font-display text-on hover:bg-oxblood-dark sm:px-6 ${big ? 'text-lg sm:text-xl' : ''}`}>Search</button>
      {shown && (
        <ul id={`${uid}-list`} role="listbox" aria-label="Suggested books" className="absolute left-0 right-0 top-full z-40 mt-1 max-h-[26rem] overflow-auto border border-ink-2/60 bg-card text-left shadow-[0_12px_28px_rgba(0,0,0,.3)]">
          {sug.items.map((b, i) => (
            <li key={b.id} id={`${uid}-o${i}`} role="option" aria-selected={active === i} onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(i)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${active === i ? 'bg-paper-2' : ''}`}>
              <div className="w-7 flex-none"><Cover book={b} mini /></div>
              <div className="min-w-0"><p className="line-clamp-1 text-lg leading-tight"><Highlight text={b.title} q={q} /></p><p className="line-clamp-1 text-sm italic text-muted"><Highlight text={b.authors.join('; ') || 'Unknown author'} q={q} /></p></div>
            </li>))}
          <li id={`${uid}-o${sug.items.length}`} role="option" aria-selected={active === sug.items.length} onMouseEnter={() => setActive(sug.items.length)} onMouseDown={(e) => e.preventDefault()} onClick={all}
            className={`cursor-pointer border-t border-line px-3 py-2 font-display text-oxblood ${active === sug.items.length ? 'bg-paper-2' : ''}`}>See all {sug.total} {sug.total === 1 ? 'result' : 'results'} for “{q.trim()}”</li>
        </ul>)}
    </form>
  );
}
