import { catalog } from './catalog';
import { authorFromRow, authorShard, isSlug, type AuthorInfo } from './authors';
type Row = Parameters<typeof authorFromRow>[1];
const shards = new Map<number, Promise<Record<string, Row> | null>>();
/** An author's name, years, book count and first titles. Reads one small file (about 30 KB); falls back to the catalogue index if it is missing. */
export async function loadAuthor(slug: string): Promise<AuthorInfo | null> {
  if (!isSlug(slug)) return null;
  const n = authorShard(slug);
  let p = shards.get(n);
  if (!p) { p = fetch(`${import.meta.env.BASE_URL}catalog/authors/${n}.json`).then(async (r) => (r.ok ? ((await r.json()) as Record<string, Row>) : null)).catch(() => null); shards.set(n, p); p.then((v) => { if (!v) shards.delete(n); }); }
  const sh = await p;
  if (sh) { const row = sh[slug]; return row ? authorFromRow(slug, row) : null; }
  return catalog.author(slug);
}
