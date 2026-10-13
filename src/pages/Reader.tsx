import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState } from '../components/ui';
import { catalog } from '../lib/catalog';
import { gutenberg } from '../lib/sourceLinks';
import { parseGutenbergText, type Parsed } from '../lib/gutenbergText';
import { TextReader } from '../components/TextReader';
import { useAsync } from '../lib/useAsync';
import { useSeo } from '../lib/useSeo';
import { readHead } from '../lib/seoText';
/** First tries to read Gutenberg's plain-text file and show it as pages in this site (nothing is stored on a server).
 *  Gutenberg may refuse that request from the browser (CORS). If it does, or the text is empty, we fall back to showing
 *  Gutenberg's own HTML page in a frame. Whether Gutenberg allows being framed is NOT verified; the visible links cover that case. */
export default function Reader() {
  const { id = '' } = useParams();
  const [book] = useAsync(() => catalog.get(id), [id]);
  const [loaded, setLoaded] = useState(false); const [full, setFull] = useState(false); const [tries, setTries] = useState(0);
  const [mode, setMode] = useState<{ kind: 'loading' } | { kind: 'text'; parsed: Parsed } | { kind: 'frame' }>({ kind: 'loading' });
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { setLoaded(false); setTries(0); }, [id]);
  useEffect(() => {
    if (!/^\d{1,9}$/.test(id)) return;
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 25000); let live = true; setMode({ kind: 'loading' });
    const get = () => fetch(gutenberg.text(id), { signal: ctl.signal }).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); });
    // One more try after a short pause: Gutenberg sometimes answers 504 when busy. (If the browser blocks the request outright, the second try fails the same way and we fall back.)
    get().catch(() => new Promise<string>((res, rej) => setTimeout(() => (ctl.signal.aborted ? rej(new Error('aborted')) : get().then(res, rej)), 1500)))
      .then((t) => { if (t.length > 15_000_000) throw new Error('too large'); const parsed = parseGutenbergText(t); if (!parsed.pages.length) throw new Error('empty'); if (live) setMode({ kind: 'text', parsed }); })
      .catch(() => { if (live) setMode({ kind: 'frame' }); })
      .finally(() => clearTimeout(timer));
    return () => { live = false; ctl.abort(); clearTimeout(timer); };
  }, [id]);
  useEffect(() => { const f = () => setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f); }, []);
  useSeo(readHead(book.status === 'ready' && book.data ? book.data.title : undefined));
  if (!/^\d{1,9}$/.test(id)) return <EmptyState title="That book number is not valid"><Link className="underline" to="/search">Search the catalogue</Link></EmptyState>;
  const title = book.status === 'ready' && book.data ? book.data.title : 'Book';
  const toggleFull = () => { if (document.fullscreenElement) document.exitFullscreen(); else box.current?.requestFullscreen?.().catch(() => {}); };
  const btn = 'border px-3 py-2 font-display text-[0.95rem] no-underline sm:px-4 sm:text-base';
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 sm:mb-4 sm:gap-3">
        <Link className="italic" to={`/book/${encodeURIComponent(id)}`}>Back to book details</Link>
        <h1 className="order-last w-full text-xl sm:text-2xl text-oxblood line-clamp-2 sm:order-none sm:w-auto sm:min-w-0 sm:flex-1 sm:line-clamp-1">{title}</h1>
        {mode.kind === 'frame' && typeof document !== 'undefined' && document.fullscreenEnabled && <button type="button" onClick={toggleFull} className={`${btn} border-ink-2 hover:bg-paper-2`}>{full ? 'Exit full screen' : 'Full screen'}</button>}
        <a href={gutenberg.readHtml(id)} target="_blank" rel="noopener noreferrer" className={`${btn} border-oxblood bg-oxblood text-on hover:bg-oxblood-dark`}>Open full page<span className="hidden sm:inline"> (print or save as PDF there)</span></a>
        {mode.kind === 'text' && <Link to={`/book/${encodeURIComponent(id)}`} className={`${btn} border-ink-2 hover:bg-paper-2`}>Download</Link>}
        <a href={gutenberg.landing(id)} target="_blank" rel="noopener noreferrer" className={`${btn} border-ink-2 hover:bg-paper-2`}>Open on Project Gutenberg</a>
      </div>
      {mode.kind === 'loading' && <div role="status" className="grid min-h-[40vh] place-items-center border border-line bg-card/60"><div className="text-center"><div className="skeleton mx-auto mb-4 h-24 w-16 border border-line" /><p className="font-display text-xl">Opening the book…</p></div></div>}
      {mode.kind === 'text' && <TextReader id={id} parsed={mode.parsed} />}
      {mode.kind === 'frame' && <>
      <p className="mb-2 text-sm italic text-muted">This book can’t be shown as pages here, so this is Project Gutenberg’s own page, shown for your visit only. Grimoire does not copy or store it. If the page below is blank or says it refused to connect, Gutenberg does not allow it here or has no HTML edition of this book. Use the buttons above instead.</p>
      <div className="mb-3 flex flex-wrap items-center gap-2 border border-line bg-card/70 p-3 text-sm">
        <span className="italic text-muted">Blank page, or an error such as “504 Gateway Time-out”? That comes from Project Gutenberg’s server being busy.</span>
        <button type="button" onClick={() => { setLoaded(false); setTries((n) => n + 1); }} className="border border-oxblood bg-oxblood px-3 py-1.5 font-display text-on hover:bg-oxblood-dark">Try again</button>
        <a href={gutenberg.text(id)} target="_blank" rel="noopener noreferrer" className="border border-ink-2 px-3 py-1.5 font-display no-underline hover:bg-paper-2">Open plain text</a>
        <Link to={`/book/${encodeURIComponent(id)}`} className="border border-ink-2 px-3 py-1.5 font-display no-underline hover:bg-paper-2">Download</Link>
      </div>
      <div ref={box} className="relative bg-white">
        {!loaded && <div role="status" className="absolute inset-0 z-10 grid place-items-center bg-card"><div className="text-center"><div className="skeleton mx-auto mb-4 h-24 w-16 border border-line" /><p className="font-display text-xl">Opening the book…</p></div></div>}
        <iframe key={tries} title={`Text of ${title}`} src={tries ? `${gutenberg.readHtml(id)}?retry=${tries}` : gutenberg.readHtml(id)} referrerPolicy="no-referrer" loading="lazy" onLoad={() => setLoaded(true)}
          sandbox="allow-popups allow-popups-to-escape-sandbox" className={`${full ? 'h-screen' : 'h-[70vh] sm:h-[80vh]'} w-full border border-line bg-white`} />
            </div>
      </>}
    </div>
  );
}
