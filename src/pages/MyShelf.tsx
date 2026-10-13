import { Link } from 'react-router-dom';
import { BookGrid, EmptyState, ErrorState, Loading, Ornament } from '../components/ui';
import { useToast } from '../components/Toast';
import { catalog } from '../lib/catalog';
import { setShelf, useShelf } from '../lib/shelf';
import { useAsync } from '../lib/useAsync';
import type { Book } from '../lib/types';
import { useSeo } from '../lib/useSeo';
import { shelfHead } from '../lib/seoText';
export default function MyShelf() {
  const { ids } = useShelf(); const toast = useToast();
  useSeo(shelfHead());
  // Load once per set of ids; removing a book just filters the list so it disappears at once.
  const [res, retry] = useAsync(async () => (await Promise.all(ids.map((i) => catalog.get(i)))).filter((b): b is Book => !!b), [ids.join(',')]);
  const copy = async (books: Book[]) => { try { await navigator.clipboard.writeText(books.map((b) => `${b.title}, ${b.authors.join('; ') || 'Unknown author'}\n${b.sourceUrl}`).join('\n\n')); toast('List copied'); } catch { toast('Could not copy the list'); } };
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl text-oxblood sm:text-4xl md:text-5xl">My shelf</h1>
        {res.status === 'ready' && res.data.length > 0 && <div className="flex gap-4">
          <button type="button" className="italic underline hover:text-oxblood" onClick={() => copy(res.data)}>Copy my list</button>
          <button type="button" className="italic underline hover:text-oxblood" onClick={() => { const old = ids; setShelf([]); toast('Shelf cleared', { label: 'Undo', run: () => setShelf(old) }); }}>Clear shelf</button></div>}
      </div>
      <p className="mt-1 italic text-muted">Books you save are kept in this browser only. Nothing is sent to a server.</p>
      <Ornament className="!mx-0 my-6" />
      {ids.length === 0 && <EmptyState title="Your shelf is empty">Tap the heart on any book to keep it here. <Link className="underline" to="/search?sort=title">Browse the catalogue</Link></EmptyState>}
      {ids.length > 0 && res.status === 'loading' && <Loading label="Loading your shelf" />}
      {ids.length > 0 && res.status === 'error' && <ErrorState message={res.message} onRetry={retry} />}
      {ids.length > 0 && res.status === 'ready' && <BookGrid books={res.data.filter((b) => ids.includes(b.id))} />}
    </div>
  );
}
