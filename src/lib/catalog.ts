import type { Book } from './types';
import type { SearchParams } from './params';
import { bookFromMeta, makeCatalog, type CatalogIndex } from './staticCatalog';
import { shardOf } from './seoText';
import type { AuthorInfo } from './authors';
export interface Page { items: Book[]; total: number; page: number; pageSize: number }
export interface Catalog {
  search(p: SearchParams): Promise<Page>;
  get(id: string): Promise<Book | null>;
  author(slug: string): Promise<AuthorInfo | null>;
  byAuthor(slug: string, page: number): Promise<Page>;
  subjects(): Promise<{ name: string; count: number }[]>;
  recent(n: number): Promise<Book[]>;
  random(n: number): Promise<Book[]>;
  stats(): Promise<{ books: number; subjects: number; authors: number; languages: number }>;
}
export class CatalogError extends Error {}
let loading: Promise<Catalog> | null = null;
let indexReady = false;
function load(): Promise<Catalog> {
  loading ??= fetch(`${import.meta.env.BASE_URL}catalog/index.json`)
    .then(async (r) => {
      if (!r.ok) throw new CatalogError('The catalog data file could not be loaded. Try again in a moment.');
      let ix: CatalogIndex;
      try { ix = await r.json(); } catch { throw new CatalogError('The catalog data file is missing. Run "npm run build:catalog" once, then reload.'); }
      if (!Array.isArray(ix?.books)) throw new CatalogError('The catalog data file is not in the expected format. Run "npm run build:catalog" again.');
      indexReady = true;
      return makeCatalog(ix);
    })
    .catch((e) => { loading = null; throw e instanceof CatalogError ? e : new CatalogError('The catalog could not be loaded. Check your connection and try again.'); });
  return loading;
}
type MetaRow = [string, string[], string, string[]];
const metaShards = new Map<number, Promise<Record<string, MetaRow> | null>>();
/** The book, null if the small file is there but has no such book, undefined if it cannot tell (fall back to the full index). */
async function fastBook(id: string): Promise<Book | null | undefined> {
  if (!/^\d{1,9}$/.test(id)) return undefined;
  const n = shardOf(id);
  let p = metaShards.get(n);
  if (!p) { p = fetch(`${import.meta.env.BASE_URL}catalog/meta/${n}.json`).then(async (r) => (r.ok ? ((await r.json()) as { b?: Record<string, MetaRow> }).b ?? null : null)).catch(() => null); metaShards.set(n, p); p.then((v) => { if (!v) metaShards.delete(n); }); }
  const shard = await p; if (!shard) return undefined;
  const row = shard[id]; return row ? bookFromMeta(id, row[0], row[1], row[2], row[3]) : null;
}
export const catalog: Catalog = {
  search: async (p) => (await load()).search(p),
  // A book page only needs one book. Read the small per-book metadata file (about 100 KB) instead of the whole catalogue index (several MB),
  // unless the index is already loaded or the small file is not there.
  get: async (id) => { if (!indexReady) { const b = await fastBook(id); if (b !== undefined) return b; } return (await load()).get(id); },
  author: async (slug) => (await load()).author(slug),
  byAuthor: async (slug, page) => (await load()).byAuthor(slug, page),
  subjects: async () => (await load()).subjects(),
  recent: async (n) => (await load()).recent(n),
  random: async (n) => (await load()).random(n),
  stats: async () => (await load()).stats(),
};
export { LANGUAGES } from './languages';
