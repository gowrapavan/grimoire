import type { Book } from './types';
import type { Catalog, Page } from './catalog';
import { PAGE_SIZE } from './params';
import { gutenberg, SHOW_GUTENBERG_COVERS } from './sourceLinks';
import { authorName, authorSlug, authorYears, type AuthorInfo, AUTHOR_LIST } from './authors';
export type IndexBook = [string, string, string[], number, number[]]; // id, title, authors, language index, subject indexes
export interface CatalogIndex { generated: string; source: string; count: number; subjects: string[]; langs: string[]; books: IndexBook[] }
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const words = (s: string) => norm(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
/** A book record from just its facts (also used with the small per-book metadata files, so a book page does not need the whole index). */
export const bookFromMeta = (id: string, title: string, authors: string[], language: string, subjects: string[]): Book => ({ id, source: 'gutenberg', sourceId: id, title, authors, language, subjects, accessStatus: 'open_access',
  sourceUrl: gutenberg.landing(id), coverUrl: SHOW_GUTENBERG_COVERS ? gutenberg.cover(id) : undefined, readUrl: gutenberg.readHtml(id), addedAt: '' });
/** Searches the catalog index fully in the browser. Gutenberg has no reliable print year, so year filters match nothing. */
export function makeCatalog(ix: CatalogIndex): Catalog {
  const rows = ix.books.map((b) => ({ b, id: Number(b[0]), title: ' ' + words(b[1]).join(' '), all: ' ' + words(b[1] + ' ' + b[2].join(' ')).join(' '), key: norm(b[1]).replace(/^[^\p{L}\p{N}]+/u, '') }));
  const byId = new Map(rows.map((r) => [r.b[0], r.b]));
  const toBook = (b: IndexBook): Book => bookFromMeta(b[0], b[1], b[2], ix.langs[b[3]] ?? '', b[4].map((i) => ix.subjects[i]));
  // Authors: built once, the first time an author page is opened.
  let authors: Map<string, { name: string; born?: string; died?: string; books: IndexBook[] }> | null = null;
  const authorMap = () => {
    if (authors) return authors;
    authors = new Map(); const key = (t: string) => norm(t).replace(/^[^\p{L}\p{N}]+/u, '');
    for (const b of ix.books) {
      const seen = new Set<string>();
      for (const raw of b[2]) {
        const slug = authorSlug(raw); if (!slug || seen.has(slug)) continue; seen.add(slug);
        let a = authors.get(slug); if (!a) { a = { name: authorName(raw), books: [] }; authors.set(slug, a); }
        const y = authorYears(raw); if (!a.born && y.born) { a.born = y.born; a.died = y.died; }
        a.books.push(b);
      }
    }
    for (const a of authors.values()) a.books.sort((x, y) => { const kx = key(x[1]), ky = key(y[1]); return kx < ky ? -1 : kx > ky ? 1 : 0; });
    return authors;
  };
  let subs: { name: string; count: number }[] | null = null;
  const cmpKey = (a: { key: string }, b: { key: string }) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  const search = async (p: Parameters<Catalog['search']>[0]): Promise<Page> => {
    const empty = { items: [], total: 0, page: p.page, pageSize: PAGE_SIZE };
    const si = p.subject ? ix.subjects.indexOf(p.subject) : -2;
    if (si === -1 || p.yearFrom || p.yearTo || (p.access && p.access !== 'open_access')) return empty;
    const toks = words(p.q).slice(0, 8);
    let r = rows.filter((x) => (!toks.length || toks.every((t) => x.all.includes(' ' + t))) && (si === -2 || x.b[4].includes(si)) && (!p.language || ix.langs[x.b[3]] === p.language));
    if (p.sort === 'recent') r.sort((a, b) => b.id - a.id);
    else if (p.sort === 'relevance' && toks.length) { const t = (x: (typeof rows)[0]) => (toks.every((k) => x.title.includes(' ' + k)) ? 0 : 1); r.sort((a, b) => t(a) - t(b) || cmpKey(a, b)); }
    else r.sort(cmpKey);
    const start = (p.page - 1) * PAGE_SIZE;
    return { items: r.slice(start, start + PAGE_SIZE).map((x) => toBook(x.b)), total: r.length, page: p.page, pageSize: PAGE_SIZE };
  };
  return {
    search,
    async get(id) { const b = byId.get(id); return b ? toBook(b) : null; },
    async author(slug): Promise<AuthorInfo | null> { const a = authorMap().get(slug); return a ? { slug, name: a.name, count: a.books.length, born: a.born, died: a.died, books: a.books.slice(0, AUTHOR_LIST).map((b) => [b[0], b[1]] as [string, string]) } : null; },
    async byAuthor(slug, page): Promise<Page> {
      const all = authorMap().get(slug)?.books ?? []; const start = (page - 1) * PAGE_SIZE;
      return { items: all.slice(start, start + PAGE_SIZE).map(toBook), total: all.length, page, pageSize: PAGE_SIZE };
    },
    async subjects() {
      if (!subs) { const c = new Array(ix.subjects.length).fill(0); ix.books.forEach((b) => b[4].forEach((i) => c[i]++));
        subs = ix.subjects.map((name, i) => ({ name, count: c[i] })).sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : 1)).slice(0, 40); }
      return subs;
    },
    async random(n) {
      const out: Book[] = [], used = new Set<number>(), want = Math.min(n, rows.length);
      while (out.length < want) { const i = Math.floor(Math.random() * rows.length); if (!used.has(i)) { used.add(i); out.push(toBook(rows[i].b)); } }
      return out;
    },
    async stats() { return { books: rows.length, subjects: ix.subjects.length, authors: new Set(ix.books.flatMap((b) => b[2])).size, languages: ix.langs.length }; },
    async recent(n) { return [...rows].sort((a, b) => b.id - a.id).slice(0, n).map((x) => toBook(x.b)); },
  };
}
