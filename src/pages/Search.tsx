import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdBanner } from '../components/AdBanner';
import { BookGrid, BookList, EmptyState, ErrorState, Loading } from '../components/ui';
import { catalog, LANGUAGES } from '../lib/catalog';
import { hasCriteria, parseParams, SORTS } from '../lib/params';
import { useDebounced, usePersisted } from '../lib/hooks';
import { useAsync } from '../lib/useAsync';
import { useSeo } from '../lib/useSeo';
import { searchHead } from '../lib/seoText';
import { SUBJECT_MIN_BOOKS } from '../lib/authors';
const SORT_LABEL: Record<string, string> = { relevance: 'Best match', title: 'Title A to Z', year_desc: 'Newest first', year_asc: 'Oldest first', recent: 'Recently added' };
function Picks() {
  const [r, retry] = useAsync(() => catalog.random(6), []);
  if (r.status === 'loading') return <Loading />; if (r.status === 'error') return <ErrorState message={r.message} onRetry={retry} />;
  return <div className="mt-8"><h2 className="mb-4 text-2xl text-oxblood">Some books to start with</h2><BookGrid books={r.data} /></div>;
}
const pagesAround = (cur: number, last: number) => {
  const s = new Set([1, 2, cur - 1, cur, cur + 1, last - 1, last].filter((n) => n >= 1 && n <= last));
  const out: (number | '…')[] = []; let prev = 0;
  [...s].sort((a, b) => a - b).forEach((n) => { if (n - prev > 1) out.push('…'); out.push(n); prev = n; }); return out;
};
export default function Search() {
  const [sp, setSp] = useSearchParams();
  const p = parseParams(sp);
  const active = hasCriteria(p);
  const [res, retry] = useAsync(() => (active ? catalog.search(p) : Promise.resolve(null)), [sp.toString()]);
  const [subs] = useAsync(() => catalog.subjects(), []);
  // Same rules as the server: only a plain subject page with enough books is offered to search engines.
  const subjectTotal = p.subject && !p.q && !p.language && res.status === 'ready' && res.data ? res.data.total : undefined;
  useSeo(searchHead(p.subject, !p.q && !p.language && p.page === 1 && (subjectTotal === undefined || subjectTotal >= SUBJECT_MIN_BOOKS), subjectTotal));
  const [view, setView] = usePersisted<'grid' | 'list'>('grimoire.view', 'grid', ['grid', 'list']);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const set = (k: string, v: string, replace = false) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); n.delete('page'); setSp(n, { replace }); };
  const go = (page: number) => { const n = new URLSearchParams(sp); n.set('page', String(page)); setSp(n); top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  // Typing filters the list live; the address bar follows without piling up history entries.
  const [text, setText] = useState(p.q); const dtext = useDebounced(text, 300); const pushed = useRef(p.q);
  useEffect(() => { if (dtext.trim() !== p.q) { pushed.current = dtext.trim(); set('q', dtext.trim(), true); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dtext]);
  useEffect(() => { if (p.q !== pushed.current) { pushed.current = p.q; setText(p.q); } }, [p.q]);
  const lbl = 'mb-2 block font-display text-lg';
  const chips: [string, string, string][] = [];
  if (p.q) chips.push(['q', 'Text', p.q]); if (p.subject) chips.push(['subject', 'Subject', p.subject]); if (p.language) chips.push(['language', 'Language', LANGUAGES[p.language] ?? p.language]);
  const nFilters = chips.length;
  const clear = () => { setText(''); pushed.current = ''; setSp(new URLSearchParams()); };
  return (
    <div className="grid gap-8 md:grid-cols-[16rem_1fr]">
      <div className="min-w-0">
        <button type="button" aria-expanded={filtersOpen} aria-controls="filters" onClick={() => setFiltersOpen((o) => !o)} className="mb-3 flex w-full items-center justify-between border border-line bg-card/70 px-4 py-2 font-display text-lg md:hidden">
          <span>Filters{nFilters ? ` (${nFilters})` : ''}</span><span aria-hidden="true">{filtersOpen ? '–' : '+'}</span></button>
        <form id="filters" aria-label="Filters" className={`${filtersOpen ? 'block' : 'hidden'} h-fit min-w-0 space-y-6 border border-line bg-card/70 p-4 md:block`} onSubmit={(e) => e.preventDefault()}>
          <div><label className={lbl} htmlFor="f-q">Title or author</label>
            <input id="f-q" type="search" value={text} maxLength={100} placeholder="Start typing" autoComplete="off" onChange={(e) => setText(e.target.value)} className="w-full border border-ink-2/50 bg-card px-3 py-2" /></div>
          <fieldset className="mx-0 mb-0 min-w-0 border-0 p-0"><legend className={`${lbl} p-0`}>Subject</legend>
            <div className="max-h-60 w-full min-w-0 overflow-x-hidden overflow-y-auto border border-line/70 bg-card/60 py-1 [scrollbar-width:thin]">
              {subs.status === 'loading' && <span className="block px-2 italic text-muted">Loading subjects…</span>}
              {subs.status === 'ready' && subs.data.map((s) => <button key={s.name} type="button" title={s.name} className="subj text-[0.95rem]" aria-pressed={p.subject === s.name} onClick={() => set('subject', p.subject === s.name ? '' : s.name)}><span>{s.name}</span><span>{s.count.toLocaleString()}</span></button>)}
            </div></fieldset>
          <fieldset className="mx-0 mb-0 min-w-0 border-0 p-0"><legend className={`${lbl} p-0`}>Language</legend>
            <div className="flex flex-wrap gap-1.5">{Object.entries(LANGUAGES).map(([c, n]) => <button key={c} type="button" className="chip text-[0.95rem]" aria-pressed={p.language === c} onClick={() => set('language', p.language === c ? '' : c)}>{n}</button>)}</div></fieldset>
          {active && <button type="button" className="underline hover:text-oxblood" onClick={clear}>Clear all filters</button>}
        </form>
      </div>
      <section aria-live="polite" ref={top} className="scroll-mt-4 min-w-0">
        <h1 className="mb-4 text-2xl text-oxblood sm:text-3xl [overflow-wrap:anywhere]">{p.subject ? p.subject : p.q ? `Results for “${p.q}”` : 'Browse the catalogue'}</h1>
        {chips.length > 0 && <ul className="mb-4 flex flex-wrap gap-2" aria-label="Active filters">{chips.map(([k, l, v]) => <li key={k}>
          <button type="button" className="chip" onClick={() => { if (k === 'q') { setText(''); pushed.current = ''; } set(k, ''); }} aria-label={`Remove ${l} filter: ${v}`}><span className="not-italic text-muted">{l}:</span> {v} <span aria-hidden="true">×</span></button></li>)}</ul>}
        {!active && <><EmptyState title="Start with a title, an author or a filter">Type in the box, or tap a subject. Results appear as you go.</EmptyState><Picks /></>}
        {active && res.status === 'loading' && <Loading />}
        {active && res.status === 'error' && <ErrorState message={res.message} onRetry={retry} />}
        {active && res.status === 'ready' && res.data && (res.data.total === 0
          ? <EmptyState title="No books match">Try fewer filters or a different spelling.{nFilters > 0 && <> <button type="button" className="underline" onClick={clear}>Clear all filters</button></>}</EmptyState>
          : <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted">{res.data.total.toLocaleString()} {res.data.total === 1 ? 'record' : 'records'}</p>
              <div className="flex flex-wrap items-center gap-4">
                <div><label htmlFor="sort" className="mr-2 text-sm">Sort by</label>
                  <select id="sort" value={p.sort} onChange={(e) => set('sort', e.target.value)} className="border border-ink-2/50 bg-card px-2 py-1">{SORTS.filter((s) => !s.startsWith('year') && (s !== 'relevance' || p.q)).map((s) => <option key={s} value={s}>{SORT_LABEL[s]}</option>)}</select></div>
                <div role="group" aria-label="Layout" className="flex border border-ink-2/50">
                  {(['grid', 'list'] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`px-3 py-1 ${view === v ? 'bg-oxblood text-on' : 'bg-card hover:bg-paper-2'}`}>{v === 'grid' ? 'Covers' : 'List'}</button>)}
                </div>
              </div>
            </div>
            {view === 'grid' ? <BookGrid books={res.data.items} narrow /> : <BookList books={res.data.items} />}
            {res.data.total > res.data.pageSize && (() => { const last = Math.ceil(res.data.total / res.data.pageSize); const nb = 'min-w-10 border border-ink-2/50 bg-card px-3 py-2 hover:bg-paper-2 disabled:opacity-40';
              return (
              <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-2">
                <button disabled={p.page <= 1} onClick={() => go(p.page - 1)} className={nb}>Previous</button>
                {pagesAround(p.page, last).map((n, i) => n === '…' ? <span key={`e${i}`} aria-hidden="true" className="px-1">…</span> : <button key={n} onClick={() => go(n)} aria-current={n === p.page ? 'page' : undefined} aria-label={`Page ${n}`} className={`${nb} ${n === p.page ? '!bg-oxblood !text-on' : ''}`}>{n}</button>)}
                <button disabled={p.page >= last} onClick={() => go(p.page + 1)} className={nb}>Next</button>
              </nav>); })()}
          </>)}
        <AdBanner slot="ad2" className="mt-12" />
      </section>
    </div>
  );
}
