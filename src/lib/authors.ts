// Author pages: one address per author, /author/<slug>. Pure functions, shared by the app, the server (worker/index.ts) and tests.
// scripts/lib/authors.mjs has a copy for the catalogue build; tests/seo.test.ts checks both give the same answers.
import { authorParts } from './openlibrary';
export const AUTHOR_SHARDS = 64;        // authors are split over this many small files: catalog/authors/<n>.json
export const AUTHOR_MIN_BOOKS = 2;      // authors with fewer books get a page but are kept out of search results and the sitemap (thin pages)
export const AUTHOR_LIST = 40;          // titles stored per author for the server-rendered list
export const SUBJECT_MIN_BOOKS = 10;    // subject pages with fewer books are not offered to search engines

export const slugify = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');
/** "Neill, John R. (John Rea), 1877-1943 [Illustrator]" -> "john-r-neill". Empty when the name has no Latin letters (no page is made). */
export const authorSlug = (raw: string) => slugify(authorParts(raw).full);
export const authorName = (raw: string) => authorParts(raw).full;
/** Birth and death years when the catalogue gives them ("1877-1943"). BCE and unclear dates are left out. */
export function authorYears(raw: string): { born?: string; died?: string } {
  const m = /(\d{3,4})\??\s*-\s*(\d{3,4})?\??/.exec(raw.replace(/\[[^\]]*\]/g, ''));
  return m ? { born: m[1], ...(m[2] ? { died: m[2] } : {}) } : {};
}
export function fnv(s: string): number { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
export const authorShard = (slug: string) => fnv(slug) % AUTHOR_SHARDS;
export const isSlug = (s: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 80;
export const authorPath = (slug: string) => `/author/${slug}`;

/** What the small author files hold. */
export interface AuthorInfo { slug: string; name: string; count: number; born?: string; died?: string; books: [string, string][] }
export const authorFromRow = (slug: string, row: [string, number, string, string, [string, string][]]): AuthorInfo => ({ slug, name: row[0], count: row[1], born: row[2] || undefined, died: row[3] || undefined, books: row[4] });
