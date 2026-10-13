import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { catalog } from '../lib/catalog';
import { useAsync } from '../lib/useAsync';
import { useIsPhone } from '../lib/hooks';
import { Cover, clothFor, ErrorState, SaveButton, StatusBadge } from './ui';

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
/** A row of book spines. Hover to lift one, click to pull it out and read its card. */
export function PullShelf() {
  const [seed, setSeed] = useState(0);
  const [res, retry] = useAsync(() => catalog.random(18), [seed]);
  const [active, setActive] = useState<number | null>(null);
  const row = useRef<HTMLDivElement>(null); const phone = useIsPhone();
  const shuffle = () => { setActive(null); setSeed((s) => s + 1); };
  const move = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const els = [...(row.current?.querySelectorAll<HTMLButtonElement>('button.spine') ?? [])]; const i = els.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return; e.preventDefault(); els[(i + (e.key === 'ArrowRight' ? 1 : -1) + els.length) % els.length].focus();
  };
  if (res.status === 'error') return <ErrorState message={res.message} onRetry={retry} />;
  const books = res.status === 'ready' ? res.data : [];
  // On phones the books stand on two shelves so every spine fits without scrolling sideways.
  const shown = phone ? books.slice(0, 16) : books;
  const shelves = phone ? [shown.slice(0, Math.ceil(shown.length / 2)), shown.slice(Math.ceil(shown.length / 2))] : [shown];
  const b = active !== null ? shown[active] : undefined;
  return (
    <section aria-labelledby="shelf-h" className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-2">
        <h2 id="shelf-h" className="text-2xl text-oxblood">Pull a book off the shelf</h2>
        <button type="button" onClick={shuffle} className="italic underline hover:text-oxblood">Shuffle the shelf</button>
      </div>
      <div className="mt-1" ref={row} role="group" aria-label="Books on the shelf" onKeyDown={move} key={seed}>
        {(res.status === 'loading' ? [[]] : shelves).map((rowBooks, r) => (
          <div key={r} className={r ? 'mt-1' : ''}>
            <div className="shelf-row">
              {res.status === 'loading' && Array.from({ length: phone ? 8 : 14 }).map((_, i) => <div key={i} className="skeleton flex-none" style={{ width: (38 + (i * 7) % 20) * (phone ? 0.66 : 1), height: (210 + (i * 23) % 60) * (phone ? 0.66 : 1) }} />)}
              {rowBooks.map((bk, j) => { const i = r * shelves[0].length + j; const h = hash(bk.title);
                return (
                  <button key={bk.id} type="button" className="spine" aria-pressed={active === i} onClick={() => setActive(active === i ? null : i)}
                    aria-label={`${bk.title}, ${bk.authors[0] ?? 'unknown author'}`}
                    style={{ '--w': `${38 + (h % 22)}px`, '--h': `${210 + ((h >> 3) % 70)}px`, '--cloth': clothFor(bk.title), '--i': i } as React.CSSProperties}>
                    <span className="spine-title" aria-hidden="true"><span>{bk.title}</span></span>
                  </button>); })}
            </div>
            <div className="plank" aria-hidden="true" />
          </div>))}
      </div>
      <div aria-live="polite" className="mt-6 min-h-[11rem]">
        {b ? (
          <div className="mx-auto grid max-w-2xl grid-cols-[6.5rem_1fr] gap-5 border border-line bg-card/80 p-4 text-left sm:grid-cols-[7.5rem_1fr]">
            <Cover book={b} />
            <div>
              <h3 className="text-2xl leading-tight text-oxblood">{b.title}</h3>
              <p className="italic text-ink-2">{b.authors.join('; ') || 'Unknown author'}</p>
              <div className="mt-2"><StatusBadge status={b.accessStatus} /></div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link to={`/book/${encodeURIComponent(b.id)}`} className="inline-block bg-oxblood px-4 py-1.5 font-display text-on no-underline hover:bg-oxblood-dark">Open details</Link>
                <Link to={`/read/${encodeURIComponent(b.id)}`} className="inline-block border border-ink-2 px-4 py-1.5 font-display no-underline hover:bg-paper-2">Read now</Link>
                <SaveButton book={b} />
              </div>
            </div>
          </div>
        ) : res.status === 'ready' && <p className="text-center italic text-muted">Click any spine to take a closer look.</p>}
      </div>
    </section>
  );
}
