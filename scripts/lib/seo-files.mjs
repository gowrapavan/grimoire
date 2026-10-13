// Files the server uses for search-engine and share-card tags. Built from the catalog index by `npm run build:catalog`.
//  catalog/meta/<n>.json            book metadata, 500 books each: the server reads one to build a book page's tags
//  catalog/authors/<n>.json         author metadata, split over 64 files: name, years, book count and the first titles
//  catalog/subjects.json            subjects with enough books to be worth a page, with their book counts
//  catalog/sitemaps/*.xml           sitemap files (pages, books, authors). __ORIGIN__ is replaced with the site address when served.
//  catalog/seo.json                 the list of sitemap files, totals, and when the catalog was built
// Cloudflare Pages allows 20,000 files per site, so there is no one-HTML-file-per-book.
import { AUTHOR_LIST, AUTHOR_MIN_BOOKS, SUBJECT_MIN_BOOKS, authorName, authorShard, authorSlug, authorYears } from './authors.mjs';
export const META_SHARD = 500;      // keep equal to META_SHARD in src/lib/seoText.ts (a test checks it)
export const SITEMAP_CHUNK = 20000; // sitemaps allow up to 50,000 per file

const xml = (urls) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>__ORIGIN__${u}</loc></url>`).join('')}</urlset>`;
const chunks = (arr) => { const out = []; for (let i = 0; i < arr.length; i += SITEMAP_CHUNK) out.push(arr.slice(i, i + SITEMAP_CHUNK)); return out.length ? out : [[]]; };

export function buildSeoFiles(index, years = new Map()) {
  const files = new Map();
  // --- books
  const shards = new Map();
  for (const [id, title, authors, li, si] of index.books) {
    const n = Math.floor(Number(id) / META_SHARD);
    if (!shards.has(n)) shards.set(n, {});
    shards.get(n)[id] = [title, authors.slice(0, 4), li >= 0 ? index.langs[li] ?? '' : '', si.slice(0, 6).map((i) => index.subjects[i])];
  }
  for (const [n, b] of shards) files.set(`meta/${n}.json`, JSON.stringify({ s: META_SHARD, b }));
  // --- authors: one entry per person, found by the slug in the address
  const authors = new Map();
  for (const [id, title, raws] of index.books) {
    const seen = new Set();
    for (const raw of raws) {
      const slug = authorSlug(raw); if (!slug || seen.has(slug)) continue; seen.add(slug);
      let a = authors.get(slug); if (!a) { a = { name: authorName(raw), born: '', died: '', books: [] }; authors.set(slug, a); }
      const y = authorYears(raw); const k = years.get(raw); if (!a.born && (y.born || k)) { a.born = y.born ?? k[0]; a.died = (y.born ? y.died : k[1]) ?? ''; }
      a.books.push([id, title.replace(/\s+/g, ' ').trim()]);
    }
  }
  const aShards = new Map();
  for (const [slug, a] of authors) {
    a.books.sort((x, y) => (x[1].toLowerCase() < y[1].toLowerCase() ? -1 : x[1].toLowerCase() > y[1].toLowerCase() ? 1 : 0));
    const n = authorShard(slug); if (!aShards.has(n)) aShards.set(n, {});
    aShards.get(n)[slug] = [a.name, a.books.length, a.born, a.died, a.books.slice(0, AUTHOR_LIST)];
  }
  for (const [n, o] of aShards) files.set(`authors/${n}.json`, JSON.stringify(o));
  // --- subjects with enough books
  const count = new Array(index.subjects.length).fill(0);
  for (const b of index.books) for (const i of b[4]) count[i]++;
  const subj = {}; index.subjects.forEach((name, i) => { if (count[i] >= SUBJECT_MIN_BOOKS) subj[name] = count[i]; });
  files.set('subjects.json', JSON.stringify({ min: SUBJECT_MIN_BOOKS, names: subj }));
  // --- sitemaps
  const names = [];
  const pages = ['/', '/search', ...Object.keys(subj).sort().map((s) => `/search?subject=${encodeURIComponent(s)}`)];
  files.set('sitemaps/sitemap-pages.xml', xml(pages)); names.push('sitemap-pages');
  chunks(index.books.map((b) => `/book/${b[0]}`)).forEach((c, i) => { files.set(`sitemaps/sitemap-books-${i + 1}.xml`, xml(c)); names.push(`sitemap-books-${i + 1}`); });
  const indexable = [...authors].filter(([, a]) => a.books.length >= AUTHOR_MIN_BOOKS).map(([slug]) => `/author/${slug}`).sort();
  chunks(indexable).forEach((c, i) => { files.set(`sitemaps/sitemap-authors-${i + 1}.xml`, xml(c)); names.push(`sitemap-authors-${i + 1}`); });
  files.set('seo.json', JSON.stringify({ sitemaps: names, total: index.books.length, authors: authors.size, indexableAuthors: indexable.length, subjects: Object.keys(subj).length, generated: index.generated ?? '' }));
  return files;
}
