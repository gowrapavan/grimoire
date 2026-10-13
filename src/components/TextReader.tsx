import { useEffect, useRef, useState } from 'react';
import type { Parsed } from '../lib/gutenbergText';
import { Ornament } from './ui';
const italics = (s: string) => s.split(/(_[^_\n]+_)/).map((p, i) => (/^_[^_\n]+_$/.test(p) ? <em key={i}>{p.slice(1, -1)}</em> : p));
const read = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
/** Reads a Gutenberg plain-text book in the page: pages, contents, text size, and a remembered place. */
export function TextReader({ id, parsed }: { id: string; parsed: Parsed }) {
  const { pages, toc } = parsed; const last = pages.length - 1;
  const [page, setPage] = useState(() => Math.min(Math.max(parseInt(read(`grimoire.read.${id}`) ?? '0', 10) || 0, 0), last));
  const [scale, setScale] = useState(() => Math.min(Math.max(parseFloat(read('grimoire.read.scale') ?? '1') || 1, 0.85), 1.6));
  const top = useRef<HTMLDivElement>(null); const first = useRef(true);
  const go = (n: number) => setPage(Math.min(Math.max(n, 0), last));
  useEffect(() => { write(`grimoire.read.${id}`, String(page)); if (first.current) { first.current = false; return; } top.current?.scrollIntoView({ block: 'start' }); }, [page, id]);
  useEffect(() => { write('grimoire.read.scale', String(scale)); }, [scale]);
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight') setPage((p) => Math.min(p + 1, last)); if (e.key === 'ArrowLeft') setPage((p) => Math.max(p - 1, 0)); };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, [last]);
  const nb = 'border border-ink-2/50 bg-card px-3 py-1.5 hover:bg-paper-2 disabled:opacity-40';
  const controls = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <button type="button" className={nb} disabled={page <= 0} onClick={() => go(page - 1)}>Previous</button>
        <span className="min-w-[6.5rem] text-center text-sm italic text-muted" aria-live="polite">Page {page + 1} of {pages.length}</span>
        <button type="button" className={nb} disabled={page >= last} onClick={() => go(page + 1)}>Next</button>
      </div>
    </div>
  );
  return (
    <div ref={top} className="scroll-mt-2">
      <p className="mb-3 border border-line bg-card/70 p-3 text-sm italic text-muted">
        This eBook is for the use of anyone anywhere in the United States and most other parts of the world at no cost and with almost no restrictions whatsoever. You may copy it, give it away or re-use it under the terms of the Project Gutenberg License included with this eBook or online at <a href="https://www.gutenberg.org/license" target="_blank" rel="noopener noreferrer">www.gutenberg.org</a>. If you are not located in the United States, you will have to check the laws of the country where you are located before using this eBook.
      </p>
      <div className="sticky top-0 z-20 -mx-1 mb-4 space-y-2 border-b border-line bg-paper/95 px-1 py-2 backdrop-blur">
        {controls}
        <div className="flex flex-wrap items-center gap-3">
          {toc.length > 1 && <><label htmlFor="toc" className="sr-only">Jump to a chapter</label>
            <select id="toc" value="" onChange={(e) => e.target.value !== '' && go(Number(e.target.value))} className="max-w-[12rem] border border-ink-2/50 bg-card px-2 py-1 text-sm sm:max-w-xs">
              <option value="">Jump to…</option>{toc.map((t, i) => <option key={i} value={t.page}>{t.title.slice(0, 60)}</option>)}</select></>}
          <div role="group" aria-label="Text size" className="ml-auto flex items-center gap-1">
            <button type="button" className={nb} aria-label="Smaller text" disabled={scale <= 0.85} onClick={() => setScale((s) => +(s - 0.1).toFixed(2))}>A−</button>
            <button type="button" className={nb} aria-label="Larger text" disabled={scale >= 1.6} onClick={() => setScale((s) => +(s + 0.1).toFixed(2))}>A+</button>
          </div>
        </div>
        <div className="h-1 bg-line/60" role="progressbar" aria-label="Reading progress" aria-valuemin={1} aria-valuemax={pages.length} aria-valuenow={page + 1}><div className="h-full bg-oxblood transition-[width]" style={{ width: `${((page + 1) / pages.length) * 100}%` }} /></div>
      </div>
      <article className="mx-auto max-w-[38rem] border border-line bg-card/70 px-4 py-6 sm:px-8 sm:py-8" style={{ fontSize: `${scale}em`, lineHeight: 1.75 }}>
        {pages[page].map((b, i) => b.kind === 'h' ? <h2 key={i} className="mb-4 mt-6 text-center text-[1.35em] leading-snug text-oxblood first:mt-0">{b.text}</h2>
          : b.kind === 'rule' ? <Ornament key={i} className="my-6" />
          : b.kind === 'verse' ? <p key={i} className="mb-4 whitespace-pre-line pl-4 italic text-ink-2">{italics(b.text)}</p>
          : <p key={i} className="mb-4 hyphens-auto">{italics(b.text)}</p>)}
      </article>
      <div className="mx-auto mt-4 max-w-[38rem]">{controls}</div>
      <p className="mx-auto mt-3 max-w-[38rem] text-center text-sm italic text-muted">Tip: use the left and right arrow keys to turn pages. Your place is remembered on this device only.</p>
    </div>
  );
}
