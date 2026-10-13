import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BookGrid, EmptyState, ErrorState, Loading, Ornament } from '../components/ui';
import { AdBanner } from '../components/AdBanner';
import { catalog } from '../lib/catalog';
import { loadAuthor } from '../lib/authorData';
import { AUTHOR_MIN_BOOKS } from '../lib/authors';
import { parseParams } from '../lib/params';
import { authorHead, notFoundHead, yearsText } from '../lib/seoText';
import { useAsync } from '../lib/useAsync';
import { useSeo } from '../lib/useSeo';

/** All books by one author. The address is /author/<name-with-dashes>. */
export default function AuthorPage() {
  const { slug = '' } = useParams(); const [sp] = useSearchParams(); const page = parseParams(sp).page;
  const [info, retryInfo] = useAsync(() => loadAuthor(slug), [slug]);
  const [res, retry] = useAsync(() => catalog.byAuthor(slug, page), [slug, page]);
  const a = info.status === 'ready' ? info.data : null;
  useSeo(a ? authorHead(a, a.count >= AUTHOR_MIN_BOOKS && page === 1) : info.status === 'ready' ? notFoundHead() : null);
  if (info.status === 'loading') return <Loading label="Loading author" />;
  if (info.status === 'error') return <ErrorState message={info.message} onRetry={retryInfo} />;
  if (!a) return <EmptyState title="We cannot find that author"><Link className="underline" to="/search">Search the catalogue</Link></EmptyState>;
  const y = yearsText(a); const last = Math.max(1, Math.ceil(a.count / 24));
  const nb = 'border border-ink-2/50 bg-card px-3 py-2 no-underline hover:bg-paper-2';
  return (
    <>
      <article className="mx-auto max-w-5xl border-4 border-double border-line bg-card/70 p-4 sm:p-5 md:p-7">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm italic"><ol className="flex flex-wrap items-center gap-x-2"><li><Link to="/">Home</Link></li><li aria-hidden="true">›</li><li aria-current="page">{a.name}</li></ol></nav>
        <h1 className="text-[1.6rem] leading-tight text-oxblood sm:text-[1.9rem] [overflow-wrap:anywhere]">{a.name}</h1>
        {y && <p className="mt-1 text-base italic text-ink-2 sm:text-lg">{y}</p>}
        <p className="mt-2 text-muted">{a.count.toLocaleString()} free {a.count === 1 ? 'ebook' : 'ebooks'} by {a.name} in the Project Gutenberg catalogue. Dates are as given by the catalogue.{' '}
          <a href={`https://www.gutenberg.org/ebooks/search/?query=${encodeURIComponent(a.name)}`} target="_blank" rel="noopener noreferrer">Find this author on Project Gutenberg<span className="sr-only"> (opens in a new tab)</span></a>.</p>
        <Ornament className="!mx-0 my-4" />
        {res.status === 'loading' && <Loading />}
        {res.status === 'error' && <ErrorState message={res.message} onRetry={retry} />}
        {res.status === 'ready' && (res.data.items.length === 0 ? <EmptyState title="No books on this page"><Link className="underline" to={`/author/${a.slug}`}>Back to the first page</Link></EmptyState> : <BookGrid books={res.data.items} narrow />)}
        {a.count > 24 && (
          <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {page > 1 ? <Link className={nb} to={page === 2 ? `/author/${a.slug}` : `/author/${a.slug}?page=${page - 1}`}>Previous</Link> : <span className={`${nb} opacity-40`}>Previous</span>}
            <span>Page {page} of {last}</span>
            {page < last ? <Link className={nb} to={`/author/${a.slug}?page=${page + 1}`}>Next</Link> : <span className={`${nb} opacity-40`}>Next</span>}
          </nav>)}
      </article>
      <div className="mx-auto max-w-5xl"><AdBanner slot="ad2" className="mt-10" /></div>
    </>
  );
}
