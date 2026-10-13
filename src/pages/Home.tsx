import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookCard, EmptyState, ErrorState, Loading, Ornament, Rail, SearchBox } from '../components/ui';
import { AdBanner } from '../components/AdBanner';
import { LibraryBanner } from '../components/LibraryBanner';
import { Favourites } from '../components/Favourites';
import { PullShelf } from '../components/PullShelf';
import { catalog } from '../lib/catalog';
import { useSurprise } from '../lib/hooks';
import { useAsync } from '../lib/useAsync';
import { useSeo } from '../lib/useSeo';
import { homeHead } from '../lib/seoText';
export default function Home() {
  const [subs, retrySubs] = useAsync(() => catalog.subjects(), []);
  const [recent, retry] = useAsync(() => catalog.recent(14), []);
  const [stats] = useAsync(() => catalog.stats(), []);
  const [more, setMore] = useState(false); const surprise = useSurprise();
  useSeo(homeHead());
  return (
    <div className="space-y-10 sm:space-y-16">
      <section className="border-4 border-double border-line bg-card/70 px-3 pb-6 pt-8 text-center sm:px-6 sm:pb-8 sm:pt-12">
        <Ornament />
        <h1 className="mt-4 text-4xl text-oxblood sm:mt-5 sm:text-5xl md:text-7xl">Biblorya</h1>
        <p className="mx-auto mt-3 max-w-xl text-lg italic sm:mt-4 sm:text-xl text-ink-2">A catalogue of books free to read, gathered from the Project Gutenberg collection.</p>
        <div className="mx-auto mt-5 flex max-w-2xl justify-center sm:mt-8"><SearchBox big /></div>
        <p className="mt-3 text-muted">
          {stats.status === 'ready' ? <>Search {stats.data.books.toLocaleString()} books by {stats.data.authors.toLocaleString()} authors. </> : null}
          <span className="hidden sm:inline">Press <kbd className="border border-line bg-paper-2 px-1.5 text-sm">Ctrl</kbd> <kbd className="border border-line bg-paper-2 px-1.5 text-sm">K</kbd> anywhere to jump to a book, or </span><button type="button" onClick={surprise} className="italic underline hover:text-oxblood">open a random one</button>.
        </p>
        <PullShelf />
      </section>

      <LibraryBanner />

      <Favourites />

      <section aria-labelledby="subj">
        <div className="flex items-baseline justify-between gap-4"><h2 id="subj" className="text-2xl text-oxblood sm:text-3xl">Index of subjects</h2>
          {subs.status === 'ready' && subs.data.length > 16 && <button type="button" aria-expanded={more} onClick={() => setMore((m) => !m)} className="italic underline hover:text-oxblood">{more ? 'Show fewer' : `Show all ${subs.data.length}`}</button>}</div>
        <div className="mt-1 border-t-4 border-double border-line" />
        {subs.status === 'loading' && <div className="mt-4"><Loading label="Loading subjects" /></div>}
        {subs.status === 'error' && <div className="mt-4"><ErrorState message={subs.message} onRetry={retrySubs} /></div>}
        {subs.status === 'ready' && (
          <ul className="mt-4 gap-x-12 md:columns-2">
            {subs.data.slice(0, more ? 40 : 16).map((s) => (
              <li key={s.name} className="break-inside-avoid">
                <Link to={`/search?subject=${encodeURIComponent(s.name)}`} className="group flex items-baseline py-1 no-underline hover:text-oxblood">
                  <span className="line-clamp-1 group-hover:underline">{s.name}</span><span aria-hidden="true" className="mx-2 min-w-6 flex-1 border-b border-dotted border-ink-2/60 group-hover:border-oxblood" /><span className="italic text-muted group-hover:text-oxblood">{s.count.toLocaleString()}</span>
                </Link></li>))}
          </ul>)}
      </section>

      <AdBanner slot="ad1" />

      <section aria-labelledby="rec">
        <h2 id="rec" className="text-2xl text-oxblood sm:text-3xl">Recent entries<span className="hidden sm:inline"> in the Gutenberg catalogue</span></h2>
        <div className="mb-4 mt-1 border-t-4 border-double border-line" />
        {recent.status === 'loading' && <Loading />}
        {recent.status === 'error' && <ErrorState message={recent.message} onRetry={retry} />}
        {recent.status === 'ready' && (recent.data.length ? <Rail label="recent entries">{recent.data.map((b) => <div role="listitem" key={b.id}><BookCard book={b} /></div>)}</Rail> : <EmptyState title="Nothing catalogued yet">Run the catalogue build to add records.</EmptyState>)}
      </section>
    </div>
  );
}
