import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AdBanner } from '../components/AdBanner';
import { BookCard, EmptyState, ErrorState, Loading, Ornament, Rail, SaveButton, StatusBadge, TiltCover } from '../components/ui';
import { useToast } from '../components/Toast';
import { catalog, LANGUAGES } from '../lib/catalog';
import { ACCESS, SOURCES } from '../lib/access';
import { parseParams } from '../lib/params';
import type { Book } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import { gutenberg } from '../lib/sourceLinks';
import { lookupOpenLibrary, type OlExtra } from '../lib/openlibrary';
import { useSeo } from '../lib/useSeo';
import { authorEntries, bookHead, notFoundHead } from '../lib/seoText';
import { authorPath, authorSlug } from '../lib/authors';
const MIN_RELATED = 6;
/** Always shows books: same-subject books first, topped up with a random pick when there are too few. */
function MoreLikeThis({ book }: { book: Book }) {
  const subject = book.subjects[0];
  const [r] = useAsync(async () => {
    await new Promise<void>((done) => setTimeout(done, 700));   // the part of the page you see first loads before this
    const same = subject ? (await catalog.search({ ...parseParams(new URLSearchParams({ subject, sort: 'recent' })) })).items.filter((b) => b.id !== book.id).slice(0, 12) : [];
    if (same.length >= MIN_RELATED) return { items: same, themed: true };
    const seen = new Set([book.id, ...same.map((b) => b.id)]);
    const extra = (await catalog.random(16)).filter((b) => !seen.has(b.id));
    return { items: [...same, ...extra].slice(0, 12), themed: false };
  }, [book.id]);
  const heading = r.status === 'ready' && r.data.themed ? `More in ${subject}` : 'You might also like';
  return (
    <section aria-labelledby="more" className="mx-auto mt-8 max-w-5xl sm:mt-10">
      <h2 id="more" className="text-lg text-oxblood sm:text-xl">{heading}</h2>
      <div className="mb-3 mt-1 border-t-4 border-double border-line" />
      {r.status === 'loading' && <Loading label="Loading more books" />}
      {r.status === 'ready' && r.data.items.length > 0 && <Rail label="more books">{r.data.items.map((b) => <div role="listitem" key={b.id}><BookCard book={b} /></div>)}</Rail>}
    </section>
  );
}
function Description({ text, source, workUrl, loading }: { text?: string; source?: 'Open Library'; workUrl?: string; loading: boolean }) {
  const [open, setOpen] = useState(false);
  const paras = (text ?? '').split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
  let shown = paras, long = false;
  if (!open) { let n = 0; shown = []; for (const p of paras) { if (shown.length && n + p.length > 700) break; shown.push(p); n += p.length; } long = shown.length < paras.length || (paras[0]?.length ?? 0) > 900; }
  const canToggle = long || open && paras.length > 1;
  return (
    <section aria-labelledby="desc" className="min-w-0">
      <h2 id="desc" className="text-lg text-oxblood sm:text-xl">About this book</h2>
      <div className="mt-2 border-l-2 border-line pl-4">
        {loading && <div role="status" aria-label="Looking for a description"><div className="skeleton h-3.5 w-full" /><div className="skeleton mt-2 h-3.5 w-11/12" /><div className="skeleton mt-2 h-3.5 w-2/3" /></div>}
        {!loading && !paras.length && <p className="italic text-muted">No description is available for this record.</p>}
        {!loading && shown.map((p, i) => <p key={i} className={`whitespace-pre-line leading-relaxed ${i === 0 ? 'text-ink' : 'mt-3 text-ink-2'} ${i === 0 && !open && p.length > 900 ? 'line-clamp-6' : ''}`}>{p}</p>)}
        {!loading && canToggle && <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="mt-3 italic text-oxblood underline hover:no-underline">{open ? 'Show less' : 'Read more'}</button>}
        {!loading && paras.length > 0 && source && <p className="mt-3 text-sm italic text-muted">From <a href={workUrl} target="_blank" rel="noopener noreferrer">{source}</a>. It describes the work, which may not be this exact edition.</p>}
      </div>
    </section>
  );
}
function AuthorCard({ a }: { a: NonNullable<OlExtra['author']> }) {
  const initials = a.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <section aria-labelledby="auth" className="h-fit border border-line bg-paper-2/40 p-4 [overflow-wrap:anywhere]">
      <div className="flex items-center gap-3">
        <div aria-hidden="true" className="grid h-11 w-11 flex-none place-items-center rounded-full bg-oxblood font-display text-lg text-on">{initials}</div>
        <div className="min-w-0"><h2 id="auth" className="font-display text-base leading-tight">{a.name}</h2>
          {(a.born || a.died) && <p className="text-sm italic text-muted">{a.born ?? '?'} to {a.died ?? '?'}</p>}</div>
      </div>
      {a.bio && <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-2">{a.bio}</p>}
      <p className="mt-2 text-sm italic text-muted">About the author, from <a href={a.url} target="_blank" rel="noopener noreferrer">Open Library</a>.</p>
    </section>
  );
}
export default function BookPage() {
  const { id = '' } = useParams(); const toast = useToast();
  const [s, retry] = useAsync(() => catalog.get(id.slice(0, 120)), [id]);
  const book = s.status === 'ready' ? s.data : null;
  useSeo(book ? bookHead(book) : s.status === 'ready' ? notFoundHead() : null);
  const [ol, setOl] = useState<OlExtra | null | 'loading'>('loading');
  useEffect(() => {
    let live = true; setOl('loading');
    if (book) lookupOpenLibrary(book.id, book.title, book.authors[0]).then((x) => { if (live) setOl(x); });
    return () => { live = false; };
  }, [book?.id]);  // eslint-disable-line react-hooks/exhaustive-deps
  if (s.status === 'loading') return <Loading />;
  if (s.status === 'error') return <ErrorState message={s.message} onRetry={retry} />;
  const b = s.data;
  if (!b) return <EmptyState title="We cannot find that record"><Link className="underline" to="/search">Search the catalogue</Link></EmptyState>;
  const src = SOURCES[b.source]; const a = ACCESS[b.accessStatus]; const crumbAuthor = authorEntries(b.authors).find((x) => x.slug);
  const rows: [string, string][] = [['Language', LANGUAGES[b.language] ?? (b.language || 'Not known')], ...(ol && ol !== 'loading' && ol.year ? [['First published', String(ol.year)] as [string, string]] : []), ['Source', src.name], ['Catalogue number', b.sourceId]];
  const btn = 'inline-block px-3.5 py-1.5 font-display text-[0.95rem] no-underline sm:px-4 sm:py-2 sm:text-base';
  const share = async () => { try { await navigator.clipboard.writeText(window.location.href); toast('Link copied'); } catch { toast('Could not copy. Copy the address from your browser bar.'); } };
  return (
    <>
    <article className="mx-auto max-w-5xl border-4 border-double border-line bg-card/70 p-4 sm:p-5 md:p-7">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm italic"><ol className="flex flex-wrap items-center gap-x-2">
        <li><Link to="/">Home</Link></li><li aria-hidden="true">›</li>
        {crumbAuthor && <><li><Link to={authorPath(crumbAuthor.slug)}>{crumbAuthor.name}</Link></li><li aria-hidden="true">›</li></>}
        <li aria-current="page" className="min-w-0 truncate">{b.title}</li></ol></nav>
      <div className="grid gap-5 lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:gap-7">
        <div className="mx-auto w-full max-w-[7.5rem] sm:max-w-[9rem] lg:aspect-[2/3] lg:max-w-none lg:max-h-[19rem] lg:self-stretch"><TiltCover book={b} fill /></div>
        <div className="flex flex-col">
          <h1 className="text-[1.45rem] leading-tight text-oxblood sm:text-[1.65rem] lg:text-[1.8rem]">{b.title}</h1>
          <p className="mt-1.5 text-base italic text-ink-2 sm:text-lg">
            {b.authors.length ? b.authors.map((au, i) => <span key={au}>{i > 0 && '; '}<Link className="hover:text-oxblood" to={authorSlug(au) ? authorPath(authorSlug(au)) : `/search?q=${encodeURIComponent(au)}`} title={`More books by ${au}`}>{au}</Link></span>) : 'Unknown author'}
          </p>
          <Ornament className="!mx-0 my-3 sm:my-4" />
          <div className="border-l-4 border-teal bg-paper-2/50 p-3 sm:p-4 lg:mt-auto">
            <div className="flex items-center gap-3"><StatusBadge status={b.accessStatus} /><span className="italic text-muted">per {src.name}</span></div>
            <p className="mt-2 text-[0.95rem]">{a.explain}</p>
            {b.accessStatus === 'open_access' && <p className="mt-1 text-sm italic text-muted">Copyright rules differ by country. See Project Gutenberg’s <a href="https://www.gutenberg.org/policy/permission.html" target="_blank" rel="noopener noreferrer">permissions page</a> before reusing a text.</p>}
            <div className="mt-4 flex flex-wrap gap-2 sm:gap-3">
              {b.accessStatus === 'open_access' && <Link to={`/read/${encodeURIComponent(b.id)}`} className={`${btn} bg-oxblood text-on hover:bg-oxblood-dark`}>Read now</Link>}
              <SaveButton book={b} full small />
              <a href={b.sourceUrl} target="_blank" rel="noopener noreferrer" className={`${btn} border border-ink-2 text-ink hover:bg-paper-2`}>View on {src.name}<span className="sr-only"> (opens in a new tab)</span></a>
              <button type="button" onClick={share} className={`${btn} border border-ink-2 hover:bg-paper-2`}>Copy link</button>
            </div>
            {b.accessStatus === 'open_access' && <p className="mt-3 text-sm italic text-muted">“Read now” shows the book’s HTML edition from {src.name} on this site for your visit only. Not every book has one.</p>}
          </div>
        </div>
      </div>
      <div className="mt-5 space-y-5 sm:mt-6 sm:space-y-6">
        <div className="space-y-5 sm:space-y-6">
  <Description loading={ol === 'loading' && !b.description} text={b.description ?? (ol && ol !== 'loading' ? ol.description : undefined)} source={!b.description && ol && ol !== 'loading' && ol.description ? 'Open Library' : undefined} workUrl={ol && ol !== 'loading' ? ol.workUrl : undefined} />
  {ol && ol !== 'loading' && ol.author && (ol.author.bio || ol.author.born || ol.author.died) && <AuthorCard a={ol.author} />}
        </div>
          {b.source === 'gutenberg' && b.accessStatus === 'open_access' && (
            <section aria-labelledby="dl">
              <h2 id="dl" className="text-lg text-oxblood sm:text-xl">Download</h2>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {gutenberg.files(b.sourceId).map((f) => (
                  <li key={f.label}><a href={f.url} target="_blank" rel="noopener noreferrer" className="block border border-line bg-card/70 px-3 py-2 no-underline hover:border-oxblood hover:bg-paper-2">
                    <span className="font-display text-base text-ink">{f.label}</span><span className="block text-sm italic text-muted">{f.hint}</span></a></li>))}
              </ul>
              <p className="mt-2 text-sm italic text-muted">Files come straight from Project Gutenberg and open in a new tab. Not every book has every format. If one does not work, try another or use “View on Project Gutenberg”.</p>
            </section>)}
          {b.subjects.length > 0 && <section aria-labelledby="subj-h"><h2 id="subj-h" className="text-lg text-oxblood sm:text-xl">Subjects</h2>
            <ul className="mt-2 flex flex-wrap gap-2">{b.subjects.map((x) => <li key={x}><Link className="chip" to={`/search?subject=${encodeURIComponent(x)}`}>{x}</Link></li>)}</ul></section>}
          <dl className="grid gap-x-10 sm:grid-cols-2">{rows.map(([k, v]) => <div key={k} className="flex items-baseline py-1"><dt className="italic text-muted">{k}</dt><span aria-hidden="true" className="mx-2 flex-1 border-b border-dotted border-ink-2/50" /><dd>{v}</dd></div>)}</dl>
        <div>
          <p className="text-sm italic text-muted">{src.credit}{ol && ol !== 'loading' && <> Extra details are looked up from Open Library using the title and author, and are not stored.</>}</p>
        </div>
      </div>
    </article>
    <MoreLikeThis book={b} />
    <div className="mx-auto max-w-5xl"><AdBanner slot="ad1" className="mt-10" /></div>
    </>
  );
}
